import { readConfig, writeConfig } from "./global";

export function getApiKey(): string | null {
    return process.env.XAI_API_KEY ?? readConfig()?.apiKey ?? null;
}

export function saveApiKey(key: string): void {
    const existing = readConfig() ?? {
        apiKey: "",
        defaultModel: "grok-3-mini",
        embeddingModel: "all-MiniLM-L6-v2",
        maxContextTokens: 80000,
        createdAt: new Date().toISOString(),
    };

    writeConfig({
        ...existing,
        apiKey: key,
    });
}

export function validateKey(key: string): boolean {
    return key.startsWith("xai-") && key.length > 20;
}

export function getGithubToken(): string | null {
    return process.env.GITHUB_TOKEN ?? readConfig()?.githubToken ?? null;
}

export function saveGithubToken(token: string): void {
    const existing = readConfig() ?? {
        apiKey: "",
        githubToken: "",
        defaultModel: "grok-3-mini",
        embeddingModel: "all-MiniLM-L6-v2",
        maxContextTokens: 80000,
        createdAt: new Date().toISOString(),
    };

    writeConfig({
        ...existing,
        githubToken: token,
    });
}

export function validateGithubToken(token: string): boolean {
    return token.startsWith("ghp_") && token.length > 20;
}
