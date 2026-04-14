import { minimatch } from "minimatch";
import { readGitignore } from "../utils/gitignore";
import { getIgnorePatterns } from "../config/local";

const SKIP_COMMIT_PATTERNS = [
    /^chore\(deps\)/i,
    /^Merge branch/,
    /^Merge pull request/,
    /^bump version/i,
    /^chore: bump/i,
    /^chore: release/i,
];

const DEFAULT_SKIP_FILES = [
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "*.min.js",
    "*.min.css",
    "dist/**",
    "build/**",
    "*.generated.ts",
    ".env*",
];

export function shouldSkipFile(file: string): boolean {
    const allPatterns = getIgnoreList();
    return allPatterns.some((pattern) => minimatch(file, pattern));
}

export function shouldSkipCommit(message: string): boolean {
    return SKIP_COMMIT_PATTERNS.some((pattern) => pattern.test(message));
}

export function getIgnoreList(): string[] {
    const gitignorePatterns = readGitignore();
    const localConfigPatterns = getIgnorePatterns() ?? [];

    return [
        ...new Set([
            ...DEFAULT_SKIP_FILES,
            ...gitignorePatterns,
            ...localConfigPatterns,
        ]),
    ];
}
