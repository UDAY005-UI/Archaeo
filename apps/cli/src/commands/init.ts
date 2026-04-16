import path from "path";
import simpleGit from "simple-git";
import { initDB } from "../storage/db";
import { saveMany as saveCommits, setCursor } from "../storage/commits.repo";
import { saveMany as savePRs, count as prCount } from "../storage/prs.repo";
import { saveCommitVector, savePrVector } from "../storage/vectors.repo";
import { saveFileRelation, incrementCoChanges } from "../storage/graph.repo";
import { getAllCommits, getRemoteUrl } from "../services/git.service";
import {
    fetchAllPRs,
    linkPRsToCommits,
    parseOwnerRepo,
} from "../services/github.service";
import {
    generateCommitVector,
    generatePrVector,
} from "../services/embedder.service";
import { shouldSkipCommit, shouldSkipFile } from "../services/filter.service";
import { addToGitignore } from "../utils/gitignore";
import { getApiKey, getGithubToken } from "../config/keys";
import { writeLocalConfig } from "../config/local";
import {
    createSpinner,
    createBar,
    updateBar,
    stopBar,
} from "../utils/progress";
import { success, error, info, warn } from "../utils/display";
import { estimateTime } from "../services/embedder.service";

const NODE_REQUIRED = 20;

export async function checkNodeVersion(): Promise<boolean> {
    const version = process.versions?.node;

    if (!version) {
        error("Unable to detect Node.js version");
        return false;
    }

    const major = Number(version.split(".")[0]);

    if (Number.isNaN(major)) {
        error(`Invalid Node.js version format: ${version}`);
        return false;
    }

    if (major < NODE_REQUIRED) {
        error(`Node.js ${NODE_REQUIRED}+ required. You have ${version}`);
        return false;
    }

    return true;
}

export async function checkIsRepo(): Promise<boolean> {
    try {
        const git = simpleGit();
        await git.status();
        return true;
    } catch {
        error("Not a git repository. Run this inside a git project.");
        return false;
    }
}

export async function checkAlreadyIndexed(): Promise<boolean> {
    const fs = await import("fs");
    return fs.existsSync(path.join(process.cwd(), ".archaeo", "index.db"));
}

export async function promptApiKey(): Promise<string | null> {
    const existing = getApiKey();
    if (existing) return existing;

    const readline = await import("readline");
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(
            "No API key found. Paste your Anthropic key: ",
            (answer) => {
                rl.close();
                resolve(answer.trim() || null);
            }
        );
    });
}

export async function promptGithubToken(): Promise<string | null> {
    const existing = getGithubToken();
    if (existing) {
        info("GitHub token found — PR descriptions will be indexed.");
        return existing;
    }

    const readline = await import("readline");
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(
            "GitHub token (optional, improves answer quality): ",
            (answer) => {
                rl.close();
                resolve(answer.trim() || null);
            }
        );
    });
}

export function createFolder(): void {
    const fs = require("fs");
    const dir = path.join(process.cwd(), ".archaeo");
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

export async function runFullIndexPipeline(): Promise<void> {
    const db = initDB(path.join(process.cwd(), ".archaeo", "index.db"));

    const spinner = createSpinner("Scanning git history...");
    const allCommits = await getAllCommits();
    const filtered = allCommits.filter((c) => !shouldSkipCommit(c.message));
    spinner.stop();
    info(`Found ${filtered.length} commits`);

    const estimatedMs = estimateTime(filtered.length);
    info(`Estimated time: ${Math.ceil(estimatedMs / 60000)} minutes`);

    saveCommits(db, filtered);

    const bar = createBar(filtered.length);
    for (let i = 0; i < filtered.length; i++) {
        const commit = filtered[i];

        if (!commit) return;

        const cleanFiles = commit.files.filter((f) => !shouldSkipFile(f));
        commit.files = cleanFiles;

        const vector = await generateCommitVector(commit);
        saveCommitVector(db, commit.hash, vector);

        for (const file of commit.files) {
            saveFileRelation(db, file, "commit", commit.hash, commit.timestamp);
        }

        for (let a = 0; a < commit.files.length; a++) {
            for (let b = a + 1; b < commit.files.length; b++) {
                const fileA = commit.files[a];
                const fileB = commit.files[b];

                if (!fileA || !fileB) continue;

                incrementCoChanges(db, fileA, fileB);
            }
        }

        updateBar(bar, i + 1);
    }
    stopBar(bar);

    const remoteUrl = await getRemoteUrl();
    if (remoteUrl) {
        const parsed = parseOwnerRepo(remoteUrl);
        if (parsed) {
            const prSpinner = createSpinner("Fetching PRs from GitHub...");
            try {
                let prs = await fetchAllPRs(parsed.owner, parsed.repo);
                prs = await linkPRsToCommits(prs, parsed.owner, parsed.repo);
                savePRs(db, prs);

                for (const pr of prs) {
                    const vector = await generatePrVector(pr);
                    savePrVector(db, pr.number, vector);
                    for (const file of pr.files) {
                        saveFileRelation(
                            db,
                            file,
                            "pr",
                            String(pr.number),
                            pr.merged_at ?? 0
                        );
                    }
                }
                prSpinner.stop();
                info(`Indexed ${prs.length} PRs`);
            } catch {
                prSpinner.stop();
                warn("Could not fetch PRs — continuing without them");
            }
        }
    }

    const first = filtered[0];
    if (first) {
        setCursor(db, first.hash);
    }

    writeLocalConfig({
        ignore: [],
        skipFiles: [],
        commitCount: filtered.length,
        prCount: await prCount(db),
        indexedAt: new Date().toISOString(),
        lastCommit: filtered[0]?.hash,
    });

    addToGitignore(".archaeo/");
}

export function printSummary(): void {
    success("✔ Indexing complete!");
    info(`Index saved to .archaeo/`);
    info(`Run: archaeo ask "why did we..."  to query your history`);
}
