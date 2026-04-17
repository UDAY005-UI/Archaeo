import Database from "better-sqlite3";
import { SearchResult } from "../types";

export function saveCommitVector(
    db: Database.Database,
    commitHash: string,
    vector: number[]
): void {
    try {
        const row = db
            .prepare(
                `
        SELECT rowid FROM commits WHERE hash = ?
        `
            )
            .get(commitHash) as { rowid: number } | undefined;

        if (!row) throw new Error(`Commit ${commitHash} not found`);

        const buffer = Buffer.from(new Float32Array(vector).buffer);

        db.prepare(
            `
            INSERT OR REPLACE INTO commit_vector (rowid, embedding)
            VALUES (?, ?)
            `
        ).run(row.rowid, buffer);
    } catch (err) {
        console.error("Failed to save commit vector:", err);
        throw err;
    }
}

export function savePrVector(
    db: Database.Database,
    number: number,
    vector: number[]
): void {
    try {
        const row = db
            .prepare(
                `
        SELECT rowid FROM pull_requests WHERE number = ?
        `
            )
            .get(number) as { rowid: number } | undefined;

        if (!row) throw new Error(`Pull request ${number} not found`);

        const buffer = Buffer.from(new Float32Array(vector).buffer);

        db.prepare(
            `
            INSERT OR REPLACE INTO prs_vector (rowid, embedding)
            VALUES (?, ?)
            `
        ).run(row.rowid, buffer);
    } catch (err) {
        console.error("Failed to save pr vector:", err);
        throw err;
    }
}

export function searchCommits(
    db: Database.Database,
    vector: number[],
    limit: number = 30
): SearchResult[] {
    try {
        const buffer = Buffer.from(new Float32Array(vector).buffer);

        const rows = db
            .prepare(
                `
      SELECT c.*, vec_distance_cosine(v.embedding, ?) as similarity
      FROM commit_vectors v
      JOIN commits c ON v.rowid = c.rowid
      ORDER BY similarity
      LIMIT ?
    `
            )
            .all(buffer, limit) as any[];

        return rows.map((row) => ({
            hash: row.hash,
            message: row.message,
            author: row.author,
            timestamp: row.timestamp,
            files: JSON.parse(row.files),
            similarity: row.similarity,
            type: "commit" as const,
        }));
    } catch (err) {
        console.error("Failed to search commits:", err);
        throw err;
    }
}

export function searchPRs(
    db: Database.Database,
    vector: number[],
    limit: number = 20
): SearchResult[] {
    try {
        const buffer = Buffer.from(new Float32Array(vector).buffer);

        const rows = db
            .prepare(
                `
      SELECT p.*, vec_distance_cosine(v.embedding, ?) as similarity
      FROM pr_vectors v
      JOIN pull_requests p ON v.rowid = p.rowid
      ORDER BY similarity
      LIMIT ?
    `
            )
            .all(buffer, limit) as any[];

        return rows.map((row) => ({
            number: row.number,
            title: row.title,
            description: row.description ?? undefined,
            author: row.author ?? undefined,
            timestamp: row.merged_at,
            files: JSON.parse(row.files),
            similarity: row.similarity,
            type: "pr" as const,
            // hash, message → undefined, not needed for PRs
        }));
    } catch (err) {
        console.error("Failed to search PRs:", err);
        throw err;
    }
}
