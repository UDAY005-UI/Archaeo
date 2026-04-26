import Database from "better-sqlite3";
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

export function isReversion(
    current: SearchResult,
    past: SearchResult
): boolean {
    // if current change touches same files as a past decision
    const sharedFiles = current.files.filter((f) => past.files.includes(f));
    if (sharedFiles.length === 0) return false;

    // if messages are semantically opposite (basic check)
    const currentMsg = (current.message ?? current.title ?? "").toLowerCase();
    const pastMsg = (past.message ?? past.title ?? "").toLowerCase();

    const reversionKeywords = [
        "revert",
        "undo",
        "rollback",
        "remove",
        "replace",
        "switch back",
    ];
    return (
        reversionKeywords.some((k) => currentMsg.includes(k)) &&
        sharedFiles.length > 0 &&
        pastMsg.length > 0
    );
}

export function buildConflictWarning(
    changedFile: string,
    pastDecision: SearchResult
): ConflictWarning {
    return {
        file: changedFile,
        currentChange: `Changes detected in ${changedFile}`,
        conflictingPR: {
            number: pastDecision.number ?? 0,
            title: pastDecision.title ?? pastDecision.message ?? "",
            mergedAt: pastDecision.timestamp,
            reason: pastDecision.description ?? pastDecision.message ?? "",
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

        // only return results that touch the same files
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

        const pastDecisions = await findPastDecisions(db, changedFiles);

        const warnings: ConflictWarning[] = [];

        for (const file of changedFiles) {
            const relevant = pastDecisions.filter((d) =>
                d.files.includes(file)
            );
            for (const decision of relevant) {
                warnings.push(buildConflictWarning(file, decision));
            }
        }

        return warnings;
    } catch (err) {
        console.error("Failed to detect conflicts:", err);
        throw err;
    }
}
