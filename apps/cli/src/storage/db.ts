import Database from "better-sqlite3";

const db = new Database("./mydb.db");

db.exec(`
    CREATE TABLE IF NOT EXISTS commits (
    hash TEXT PRIMARY KEY,
    message TEXT NOT NULL,
    author TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    files TEXT NOT NULL,
    diff_summary TEXT,
    embedding BLOB
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

    CREATE VIRTUAL TABLE IF NOT EXISTS commit_vectors USING vec0(
    embedding float[1536]
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS pr_vectors USING vec0(
    embedding float[1536]
    );

    CREATE INDEX IF NOT EXISTS idx_file_graph_path ON file_graph(file_path);
    CREATE INDEX IF NOT EXISTS idx_commits_timestamp ON commits(timestamp);
    `);
