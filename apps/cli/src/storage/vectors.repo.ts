import Database from "better-sqlite3";
import { SearchResult } from "../types";

export function saveCommitVector(
    db: Database.Database,
    commitHash: string,
    vector: number[]
): void {
    try {
        const buffer = Buffer.from(new Float32Array(vector).buffer);
        const result = db
            .prepare(`INSERT INTO commit_vectors (embedding) VALUES (?)`)
            .run(buffer);

        // save the mapping
        db.prepare(
            `INSERT INTO commit_vector_map (rowid, hash) VALUES (?, ?)`
        ).run(result.lastInsertRowid, commitHash);
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
        const buffer = Buffer.from(new Float32Array(vector).buffer);
        const result = db
            .prepare(`INSERT INTO pr_vectors (embedding) VALUES (?)`)
            .run(buffer);

        db.prepare(
            `INSERT INTO pr_vector_map (rowid, number) VALUES (?, ?)`
        ).run(result.lastInsertRowid, number);
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
JOIN commit_vector_map m ON v.rowid = m.rowid
JOIN commits c ON m.hash = c.hash
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
JOIN pr_vector_map m ON v.rowid = m.rowid
JOIN pull_requests p ON m.number = p.number
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
