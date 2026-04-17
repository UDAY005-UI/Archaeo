import fs from "fs";
import os from "os";
import path from "path";
import { GlobalConfig } from "../types";

const DEFAULT_CONFIG: GlobalConfig = {
    apiKey: "",
    githubToken: "",
    defaultModel: "claude-3-sonnet",
    embeddingModel: "text-embedding-3-small",
    maxContextTokens: 4000,
    createdAt: new Date().toISOString(),
};

const CONFIG_DIR = path.join(os.homedir(), ".archaeo");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export function readConfig(): GlobalConfig | null {
    if (!fs.existsSync(CONFIG_FILE)) return null;

    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");

    return JSON.parse(raw);
}

export function writeConfig(data: GlobalConfig) {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

export function updateConfig(
    data: Partial<GlobalConfig>
): Partial<GlobalConfig> | null {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    const existing = readConfig() ?? DEFAULT_CONFIG;

    const updated = {
        ...existing,
        ...data,
    };

    writeConfig(updated);

    return updated;
}

export function getGlobalConfigPath(): string {
    return CONFIG_FILE;
}
