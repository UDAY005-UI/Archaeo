import Database from "better-sqlite3";
import { Issue, IssueRow } from "../types";

export function save(db: Database.Database, issue: Issue): void {
    try {
        db.prepare(
            `
            INSERT OR REPLACE INTO issues (number, title, body, labels, comments)
            VALUES (?, ?, ?, ?, ?)
            `
        ).run(
            issue.number,
            issue.title,
            issue.body,
            JSON.stringify(issue.labels),
            JSON.stringify(issue.comments)
        );
    } catch (err) {
        console.error("Failed to insert issue:", err);
        throw err;
    }
}

export function saveMany(db: Database.Database, issues: Issue[]): void {
    if (!issues || issues.length === 0) return;

    const insert = db.prepare(`
        INSERT OR REPLACE INTO issues (number, title, body, labels, comments)
        VALUES (?, ?, ?, ?, ?)
        `);

    const transaction = db.transaction((issues: Issue[]) => {
        for (const issue of issues) {
            insert.run(
                issue.number,
                issue.title,
                issue.body,
                JSON.stringify(issue.labels),
                JSON.stringify(issue.comments)
            );
        }
    });

    try {
        transaction(issues);
    } catch (err) {
        console.error("Failed to insert issues:", err);
        throw err;
    }
}

export function findByNumber(
    db: Database.Database,
    number: number
): Issue | null {
    try {
        const row = db
            .prepare(
                `
            SELECT * FROM issues WHERE number = ?
            `
            )
            .get(number) as IssueRow | undefined;

        if (!row) return null;

        return {
            ...row,
            labels: JSON.parse(row.labels),
            comments: JSON.parse(row.comments),
        };
    } catch (err) {
        console.error("Failed to fetch issue by issue number:", err);
        throw err;
    }
}

export function count(db: Database.Database): number {
    try {
        const row = db
            .prepare(
                `
            SELECT COUNT (*) as count FROM issues
            `
            )
            .get() as { count: number };

        return row.count;
    } catch (err) {
        console.error("Failed to fetch numer of opened issues:", err);
        throw err;
    }
}
