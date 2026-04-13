import fs from "fs";
import path from "path";
import { RepoConfig } from "../types";

const CONFIG_DIR = path.join(process.cwd(), ".archaeo");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export function readLocalConfig(): RepoConfig | null {
    if (!fs.existsSync(CONFIG_FILE)) return null;

    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");

    return JSON.parse(raw);
}

export function writeLocalConfig(data: RepoConfig) {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

export function getIgnorePatterns(): string[] | null {
    const config = readLocalConfig();
    return (
        config?.ignore ?? [
            "package-lock.json",
            "yarn.lock",
            "**/*.spec.ts",
            "dist/**",
            "build/**",
        ]
    );
}

export function updateLastIndexed(hash: string, newCommitCount: number) {
    const existing = readLocalConfig();

    writeLocalConfig({
        ignore: existing?.ignore ?? [],
        skipFiles: existing?.skipFiles ?? [],
        commitCount: (existing?.commitCount ?? 0) + newCommitCount,
        prCount: existing?.prCount ?? 0,
        ...existing,
        lastCommit: hash,
        indexedAt: new Date().toISOString(),
    });
}
