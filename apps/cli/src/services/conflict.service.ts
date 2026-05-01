import Database from "better-sqlite3";
import { execSync } from "child_process";
import { ConflictWarning, SearchResult } from "../types";
import { getCurrentDiff } from "./git.service";
import { generateQueryVector } from "./embedder.service";
import { searchCommits, searchPRs } from "../storage/vectors.repo";

export function extractChangedFiles(diff: {
    unstaged: string;
    staged: string;
}): string[] {
    const combined = diff.unstaged + diff.staged;

    const fileMatches = combined.match(/^diff --git a\/.+ b\/(.+)$/gm) ?? [];

    return fileMatches
        .map((line) => {
            const match = line.match(/b\/(.+)$/);
            return match?.[1] ?? "";
        })
        .filter(Boolean);
}

export function getRemovedLines(diff: string): string[] {
    return diff
        .split("\n")
        .filter((line) => line.startsWith("-") && !line.startsWith("---"))
        .map((line) => line.slice(1).trim())
        .filter((line) => line.length > 5);
}

export function findCommitThatAddedLine(line: string): string | null {
    try {
        const escaped = line.replace(/"/g, '\\"').replace(/`/g, "\\`");
        const result = execSync(
            `git log -S "${escaped}" --oneline -1 2>/dev/null`
        )
            .toString()
            .trim();
        return result || null;
    } catch {
        return null;
    }
}

export function buildConflictWarning(
    changedFile: string,
    removedLine: string,
    commitInfo: string
): ConflictWarning {
    const parts = commitInfo.split(" ");
    const hash = parts[0] ?? "";
    const message = parts.slice(1).join(" ");

    return {
        file: changedFile,
        currentChange: `Removing: "${removedLine}"`,
        conflictingPR: {
            number: 0,
            title: message,
            mergedAt: 0,
            reason: `This line was deliberately added in commit ${hash}: "${message}"`,
        },
    };
}

export async function findPastDecisions(
    db: Database.Database,
    files: string[]
): Promise<SearchResult[]> {
    try {
        const query = `changes to ${files.join(", ")}`;
        const vector = await generateQueryVector(query);

        const commits = searchCommits(db, vector, 20);
        const prs = searchPRs(db, vector, 10);

        return [...commits, ...prs].filter((result) =>
            files.some((f) => result.files.includes(f))
        );
    } catch (err) {
        console.error("Failed to find past decisions:", err);
        throw err;
    }
}

export async function detectConflicts(
    db: Database.Database
): Promise<ConflictWarning[]> {
    try {
        const diff = await getCurrentDiff();
        const changedFiles = extractChangedFiles(diff);

        if (changedFiles.length === 0) return [];

        const combined = diff.staged || diff.unstaged;
        const removedLines = getRemovedLines(combined);

        if (removedLines.length === 0) return [];

        const warnings: ConflictWarning[] = [];
        const seen = new Set<string>();

        for (const file of changedFiles) {
            for (const line of removedLines) {
                const commitInfo = findCommitThatAddedLine(line);
                if (!commitInfo) continue;

                const key = `${file}:${commitInfo}`;
                if (seen.has(key)) continue;
                seen.add(key);

                warnings.push(buildConflictWarning(file, line, commitInfo));
            }
        }

        return warnings;
    } catch (err) {
        console.error("Failed to detect conflicts:", err);
        throw err;
    }
}
