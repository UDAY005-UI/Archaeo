import Database from "better-sqlite3";
import { PullRequest, PullRequestRow } from "../types";

export function save(db: Database.Database, pr: PullRequest): void {
    try {
        db.prepare(
            `
        INSERT OR REPLACE INTO pull_requests (number, title, description, author, merged_at, commits, files)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
            pr.number,
            pr.title,
            pr.description,
            pr.author,
            pr.merged_at,
            JSON.stringify(pr.commits),
            JSON.stringify(pr.files)
        );
    } catch (err) {
        console.error("Failed to insert pull requests:", err);
        throw err;
    }
}

export function saveMany(db: Database.Database, prs: PullRequest[]): void {
    if (!prs || prs.length === 0) return;

    const insert = db.prepare(`
        INSERT OR REPLACE INTO pull_requests (number, title, description, author, merged_at, commits, files)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

    const transaction = db.transaction((prs: PullRequest[]) => {
        for (const pr of prs) {
            insert.run(
                pr.number,
                pr.title,
                pr.description,
                pr.author,
                pr.merged_at,
                JSON.stringify(pr.commits),
                JSON.stringify(pr.files)
            );
        }
    });
    try {
        transaction(prs);
    } catch (err) {
        console.error("Failed to insert pull requests:", err);
        throw err;
    }
}

export function findByNumber(
    db: Database.Database,
    number: number
): PullRequest | null {
    try {
        const row = db
            .prepare(
                `
            SELECT * FROM pull_requests WHERE number = ?
            `
            )
            .get(number) as PullRequestRow | undefined;

        if (!row) return null;

        return {
            ...row,
            files: JSON.parse(row.files),
            commits: JSON.parse(row.commits),
        };
    } catch (err) {
        console.error("Failed to fetch pull requests by file:", err);
        throw err;
    }
}

export function findByFile(
    db: Database.Database,
    file: string
): PullRequest[] | null {
    try {
        const rows = db
            .prepare(
                `
            SELECT * FROM pull_requests WHERE EXISTS (
            SELECT 1
            FROM json_each(pull_requests.files)
            WHERE json_each.value = ?)
            `
            )
            .all(file) as PullRequestRow[];

        return rows.map((row) => ({
            ...row,
            files: JSON.parse(row.files),
            commits: JSON.parse(row.commits),
        }));
    } catch (err) {
        console.error("Failed to fetch pull requests by file:", err);
        throw err;
    }
}

export function count(db: Database.Database): number {
    try {
        const row = db
            .prepare(
                `
            SELECT COUNT(*) as count FROM pull_requests
            `
            )
            .get() as { count: number };

        return row.count;
    } catch (err) {
        console.error("Failed to fetch number of commits:", err);
        throw err;
    }
}
