import Database from "better-sqlite3";
import { getLoadablePath } from "sqlite-vec";

export function openDB(dbPath: string): Database.Database {
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.loadExtension(getLoadablePath());
    return db;
}

export function createSchema(db: Database.Database): void {
    db.exec(`
    CREATE TABLE IF NOT EXISTS commits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT UNIQUE NOT NULL,
    message TEXT NOT NULL,
    author TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    files TEXT NOT NULL,
    diff_summary TEXT
    );

    CREATE TABLE IF NOT EXISTS pull_requests (
    number INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    author TEXT,
    merged_at INTEGER,
    commits TEXT,
    files TEXT
    );

    CREATE TABLE IF NOT EXISTS file_graph (
    file_path TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS co_changes (
    file_a TEXT NOT NULL,
    file_b TEXT NOT NULL,
    count INTEGER DEFAULT 0,
    PRIMARY KEY (file_a, file_b)
    );

    CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
    );

    CREATE TABLE IF NOT EXISTS issues (
    number INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT,
    labels TEXT,
    comments TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_file_graph_path ON file_graph(file_path);
    CREATE INDEX IF NOT EXISTS idx_commits_timestamp ON commits(timestamp);
    `);

    db.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS commit_vectors USING vec0(
    embedding float[384]
    );

    CREATE TABLE IF NOT EXISTS commit_vector_map (
  rowid INTEGER PRIMARY KEY,
  hash TEXT NOT NULL
);

    CREATE VIRTUAL TABLE IF NOT EXISTS pr_vectors USING vec0(
    embedding float[384]
    );

    CREATE TABLE IF NOT EXISTS pr_vector_map (
  rowid INTEGER PRIMARY KEY,
  number INTEGER NOT NULL
);
    `);
}

export function initDB(dbPath: string): Database.Database {
    const db = openDB(dbPath);
    createSchema(db);
    return db;
}
