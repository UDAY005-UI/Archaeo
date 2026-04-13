import Database from "better-sqlite3";
import { Commit, CommitRow } from "../types";

export function save(db: Database.Database, commit: Commit): void {
    try {
        db.prepare(
            `
        INSERT OR REPLACE INTO commits (hash, message, author, timestamp, files, diff_summary)
        VALUES (?, ?, ?, ?, ?, ?)
        `
        ).run(
            commit.hash,
            commit.message,
            commit.author,
            commit.timestamp,
            JSON.stringify(commit.files),
            commit.diff_summary ?? null
        );
    } catch (err) {
        console.error("Failed to insert commit:", err);
        throw err;
    }
}

export function saveMany(db: Database.Database, commits: Commit[]): void {
    if (!commits || commits.length === 0) return;

    const insert = db.prepare(`
        INSERT OR REPLACE INTO commits (hash, message, author, timestamp, files, diff_summary)
        VALUES (?, ?, ?, ?, ?, ?)`);

    const transaction = db.transaction((commits: Commit[]) => {
        for (const commit of commits) {
            insert.run(
                commit.hash,
                commit.message,
                commit.author,
                commit.timestamp,
                JSON.stringify(commit.files),
                commit.diff_summary ?? null
            );
        }
    });
    try {
        transaction(commits);
    } catch (err) {
        console.error("Failed to insert commits:", err);
        throw err;
    }
}

export function findByHash(db: Database.Database, hash: string): Commit | null {
    try {
        const row = db
            .prepare(
                `
            SELECT * FROM commits WHERE hash = ?
            `
            )
            .get(hash) as CommitRow | undefined;

        if (!row) return null;

        return {
            ...row,
            files: JSON.parse(row.files),
        };
    } catch (err) {
        console.error("Failed to fetch commit by hash:", err);
        throw err;
    }
}

export function findByFile(
    db: Database.Database,
    file: string
): Commit[] | null {
    try {
        const rows = db
            .prepare(
                `
            SELECT * FROM commits WHERE EXISTS (
            SELECT 1
            FROM json_each(commits.files)
            WHERE json_each.value = ?)
            `
            )
            .all(file) as CommitRow[];

        return rows.map((row) => ({
            ...row,
            files: JSON.parse(row.files),
        }));
    } catch (err) {
        console.error("Failed to fetch commits by file:", err);
        throw err;
    }
}

export function count(db: Database.Database): number {
    try {
        const row = db
            .prepare(
                `
            SELECT COUNT(*) as count FROM commits
            `
            )
            .get() as { count: number };

        return row.count;
    } catch (err) {
        console.error("Failed to fetch number of commits:", err);
        throw err;
    }
}

export function setCursor(db: Database.Database, hash: string): void {
    try {
        db.prepare(
            `
            INSERT OR REPLACE INTO meta (key, value)
            VALUES (?, ?)`
        ).run("last_indexed_commit", hash);
    } catch (err) {
        console.error("Failed to set latest commit in meta:", err);
        throw err;
    }
}

export function getCursor(db: Database.Database): string | null {
    try {
        const row = db
            .prepare(
                `
        SELECT * FROM meta WHERE key = ?`
            )
            .get("last_indexed_commit") as { value: string } | undefined;

        if (!row) return null;

        return row.value;
    } catch (err) {
        console.error("Failed to fetch latest commit from meta:", err);
        throw err;
    }
}
