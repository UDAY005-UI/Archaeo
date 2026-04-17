import path from "path";
import { initDB } from "../storage/db";
import { getAllCommits } from "../services/git.service";
import { saveMany, getCursor, setCursor } from "../storage/commits.repo";
import { saveCommitVector } from "../storage/vectors.repo";
import { saveFileRelation, incrementCoChanges } from "../storage/graph.repo";
import { generateCommitVector } from "../services/embedder.service";
import { shouldSkipCommit, shouldSkipFile } from "../services/filter.service";
import { success, info, warn } from "../utils/display";
import { writeLocalConfig, readLocalConfig } from "../config/local";

export async function runUpdate(): Promise<void> {
    const db = initDB(path.join(process.cwd(), ".archaeo", "index.db"));

    const cursor = getCursor(db);
    if (!cursor) {
        warn("No cursor found. Run: archaeo init");
        return;
    }

    info("Checking for new commits...");
    const allCommits = await getAllCommits();
    const cursorIndex = allCommits.findIndex((c) => c.hash === cursor);
    const newCommits =
        cursorIndex === -1 ? [] : allCommits.slice(0, cursorIndex);
    const filtered = newCommits.filter((c) => !shouldSkipCommit(c.message));

    if (filtered.length === 0) {
        success("✔ Already up to date!");
        return;
    }

    const latest = filtered[0];

    if (!latest) {
        return;
    }

    info(`Found ${filtered.length} new commits. Indexing...`);

    saveMany(db, filtered);

    for (const commit of filtered) {
        commit.files = commit.files.filter((f) => !shouldSkipFile(f));
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
    }

    setCursor(db, latest.hash);
    const existing = readLocalConfig();
    writeLocalConfig({
        ignore: existing?.ignore ?? [],
        skipFiles: existing?.skipFiles ?? [],
        commitCount: (existing?.commitCount ?? 0) + filtered.length,
        prCount: existing?.prCount ?? 0,
        ...existing,
        lastCommit: latest.hash,
        indexedAt: new Date().toISOString(),
    });

    success(`✔ Indexed ${filtered.length} new commits!`);
}
