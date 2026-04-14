// src/types/index.ts

// ─── Database Entities ───────────────────────────────────────────

export interface Commit {
    hash: string;
    message: string;
    author: string;
    timestamp: number; // unix epoch
    files: string[]; // parsed from JSON in DB
    diff_summary?: string;
    embedding?: Buffer;
}

export interface CommitRow {
    hash: string;
    message: string;
    author: string;
    timestamp: number; // unix epoch
    files: string; // parsed from JSON in DB
    diff_summary?: string;
    embedding?: Buffer;
}

export interface PullRequest {
    number: number;
    title: string;
    description?: string;
    author?: string;
    merged_at?: number;
    commits: string[]; // commit hashes
    files: string[];
    embedding?: Buffer;
}

export interface PullRequestRow {
    number: number;
    title: string;
    description?: string;
    author?: string;
    merged_at?: number;
    commits: string; // commit hashes
    files: string;
    embedding?: Buffer;
}

export interface FileGraphEntry {
    file_path: string;
    entity_type: "commit" | "pr";
    entity_id: string | number;
    timestamp: number;
}

export interface CoChange {
    file_a: string;
    file_b: string;
    count: number;
}

// ─── Retrieval & Search ──────────────────────────────────────────

export type QuestionType = "why" | "when" | "who" | "what" | "history";

export interface SearchResult {
    hash?: string; // for commits
    number?: number; // for PRs
    message?: string; // commit message
    title?: string; // PR title
    description?: string; // PR description
    author?: string;
    timestamp: number;
    files: string[];
    similarity: number; // raw vector score 0-1
    score?: number; // after re-ranking
    type: "commit" | "pr";
}

export interface RetrievalContext {
    question: string;
    questionType: QuestionType;
    fileHints: string[];
    results: SearchResult[];
    totalTokens: number;
}

// ─── Config ──────────────────────────────────────────────────────

export interface GlobalConfig {
    apiKey: string;
    githubToken?: string;
    defaultModel: string;
    embeddingModel: string;
    maxContextTokens: number;
    createdAt: string;
}

export interface RepoConfig {
    ignore: string[];
    skipFiles: string[];
    githubOwner?: string;
    githubRepo?: string;
    indexedAt?: string;
    lastCommit?: string;
    commitCount: number;
    prCount: number;
}

// ─── Indexing Pipeline ───────────────────────────────────────────

export interface IndexingOptions {
    skipGithub?: boolean;
    ignorePatterns?: string[];
    quickMode?: boolean; // only embed commits with >50 char messages
    scope?: string; // monorepo path filter
    allHistory?: boolean; // override 2-year default cutoff
}

export interface IndexingProgress {
    totalCommits: number;
    processedCommits: number;
    totalPRs: number;
    processedPRs: number;
    estimatedCostUsd: number;
    startedAt: Date;
}

// ─── CLI Command Options ─────────────────────────────────────────

export interface AskOptions {
    json?: boolean;
    noPr?: boolean;
    since?: string; // ISO date string
}

export interface HistoryOptions {
    limit?: number;
}

// ─── AI Layer ────────────────────────────────────────────────────

export interface AnswerSource {
    type: "commit" | "pr";
    id: string;
    description: string;
}

export interface ClaudeAnswer {
    answer: string;
    sources: AnswerSource[];
    confidence: "high" | "medium" | "low";
}

// ─── Conflict Detection ──────────────────────────────────────────

export interface ConflictWarning {
    file: string;
    lines?: string;
    currentChange: string;
    conflictingPR: {
        number: number;
        title: string;
        mergedAt: number;
        reason: string;
    };
}

// ─── Index Stats (for `codebase-why status`) ─────────────────────

export interface IndexStats {
    commitCount: number;
    prCount: number;
    lastIndexed: string;
    dbSizeBytes: number;
    repoRemoteUrl?: string;
}

export interface TimelineEntry {
    timestamp: number; // unix epoch
    author: string;
    message: string;
    hash: string;
}
