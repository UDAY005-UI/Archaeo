import { readConfig, writeConfig } from "./global";

export function getApiKey(): string | null {
    const config = readConfig();
    if (config?.isLocal) return "local";
    return (
        config?.apiKey ??
        process.env.GEMINI_API_KEY ??
        process.env.OPENAI_API_KEY ??
        process.env.ANTHROPIC_API_KEY ??
        null
    );
}

export function saveApiKey(key: string): void {
    const existing = readConfig() ?? {
        provider: "gemini" as const,
        apiKey: "",
        model: "gemini-2.5-flash-lite",
        isLocal: false,
        localUrl: "",
        localModel: "",
        maxContextTokens: 80000,
        createdAt: new Date().toISOString(),
    };
    writeConfig({ ...existing, apiKey: key });
}

export function validateKey(key: string): boolean {
    return key.length > 20;
}

export function getGithubToken(): string | null {
    return process.env.GITHUB_TOKEN ?? readConfig()?.githubToken ?? null;
}

export function saveGithubToken(token: string): void {
    const existing = readConfig() ?? {
        provider: "gemini" as const,
        apiKey: "",
        model: "gemini-2.5-flash-lite",
        isLocal: false,
        localUrl: "",
        localModel: "",
        maxContextTokens: 80000,
        createdAt: new Date().toISOString(),
    };
    writeConfig({ ...existing, githubToken: token });
}

export function validateGithubToken(token: string): boolean {
    return token.startsWith("ghp_") && token.length > 20;
}
