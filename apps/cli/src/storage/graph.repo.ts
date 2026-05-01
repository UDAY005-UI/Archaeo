import Database from "better-sqlite3";
import { FileGraphEntry, CoChange } from "../types";

export function saveFileRelation(
    db: Database.Database,
    filePath: string,
    entityType: "commit" | "pr",
    entityId: string | number,
    timestamp: number
): void {
    try {
        db.prepare(
            `
            INSERT OR REPLACE INTO file_graph (file_path, entity_type, entity_id, timestamp)
            VALUES (?, ?, ?, ?)
            `
        ).run(filePath, entityType, entityId, timestamp);
    } catch (err) {
        console.error("Failed to save file relation in file graph table:", err);
        throw err;
    }
}

export function extractFileDiff(
    diffSummary: string | null,
    filePath: string
): string {
    if (!diffSummary) return "";
    const sections = diffSummary.split(/^diff --git /m);
    const match = sections.find(
        (s) => s.includes(`a/${filePath}`) || s.includes(`b/${filePath}`)
    );
    return match ? `diff --git ${match}`.trim() : "";
}

export function getFileHistory(
    db: Database.Database,
    filePath: string
): { entry: FileGraphEntry; message: string; diff: string }[] | null {
    try {
        const rows = db
            .prepare(`SELECT * FROM file_graph WHERE file_path = ?`)
            .all(filePath) as FileGraphEntry[] | undefined;

        if (!rows || rows.length === 0) return null;

        const result: {
            entry: FileGraphEntry;
            message: string;
            diff: string;
        }[] = [];

        for (const entry of rows) {
            if (entry.entity_type !== "commit") continue;

            const commit = db
                .prepare(
                    `SELECT message, diff_summary FROM commits WHERE hash = ?`
                )
                .get(entry.entity_id) as
                | { message: string; diff_summary: string }
                | undefined;

            if (!commit) continue;

            const diff = extractFileDiff(commit.diff_summary, filePath);

            result.push({
                entry,
                message: commit.message,
                diff,
            });
        }

        return result.length === 0 ? null : result;
    } catch (err) {
        console.error("Failed to fetch history:", err);
        throw err;
    }
}

export function incrementCoChanges(
    db: Database.Database,
    file_a: string,
    file_b: string
): void {
    try {
        db.prepare(
            `
            INSERT INTO co_changes (file_a, file_b, count)
            VALUES (?, ?, 1)
            ON CONFLICT(file_a, file_b)
            DO UPDATE SET count = count + 1;
            `
        ).run(file_a, file_b);
    } catch (err) {
        console.error("Failed to increment co-changes:", err);
        throw err;
    }
}

export function getCoChanges(
    db: Database.Database,
    file_a: string,
    file_b: string
): CoChange | null {
    try {
        const row = db
            .prepare(
                `
            SELECT * FROM co_changes WHERE file_a = ? AND file_b = ?
            `
            )
            .get(file_a, file_b) as CoChange;

        if (!row) return null;

        return {
            ...row,
        };
    } catch (err) {
        console.error("Failed to get co-changes:", err);
        throw err;
    }
}
