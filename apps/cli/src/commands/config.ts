import { readConfig, writeConfig } from "../config/global";
import {
    saveApiKey,
    saveGithubToken,
    validateKey,
    validateGithubToken,
} from "../config/keys";
import { success, error, info } from "../utils/display";
import readline from "readline";

async function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

export async function runConfig(options: {
    key?: string;
    github?: string;
    provider?: string;
    model?: string;
    switch?: string;
    localUrl?: string;
    localModel?: string;
}): Promise<void> {
    const existing = readConfig();

    if (options.switch) {
        if (!existing) {
            error("No config found. Run: archaeo init");
            return;
        }

        if (options.switch === "local") {
            if (!existing.localUrl || !existing.localModel) {
                error(
                    "Set local provider first: archaeo config --local-url <url> --local-model <model>"
                );
                return;
            }
            writeConfig({ ...existing, isLocal: true });
            success("Switched to local model!");
            return;
        }

        if (options.switch === "cloud") {
            writeConfig({ ...existing, isLocal: false });
            success("Switched to cloud model!");
            return;
        }
    }

    if (options.localUrl || options.localModel) {
        const base = existing ?? {
            provider: "gemini" as const,
            apiKey: "",
            model: "gemini-2.5-flash-lite",
            isLocal: false,
            localUrl: "",
            localModel: "",
            maxContextTokens: 80000,
            createdAt: new Date().toISOString(),
        };
        writeConfig({
            ...base,
            localUrl: options.localUrl ?? existing?.localUrl ?? "",
            localModel: options.localModel ?? existing?.localModel ?? "",
        });
        success("Local provider saved!");
        return;
    }

    if (options.provider) {
        const base = existing ?? {
            provider: "gemini" as const,
            apiKey: "",
            model: "gemini-2.5-flash-lite",
            isLocal: false,
            localUrl: "",
            localModel: "",
            maxContextTokens: 80000,
            createdAt: new Date().toISOString(),
        };
        writeConfig({ ...base, provider: options.provider as any });
        success(`Provider set to ${options.provider}!`);
        return;
    }

    if (options.model) {
        if (!existing) {
            error("No config found. Run: archaeo init");
            return;
        }
        writeConfig({ ...existing, model: options.model });
        success(`Model set to ${options.model}!`);
        return;
    }

    if (options.key) {
        if (!validateKey(options.key)) {
            error("Invalid API key.");
            return;
        }
        saveApiKey(options.key);
        success("API key saved!");
        return;
    }

    if (options.github) {
        if (!validateGithubToken(options.github)) {
            error("Invalid GitHub token.");
            return;
        }
        saveGithubToken(options.github);
        success("GitHub token saved!");
        return;
    }

    info("Current config:");
    info(`Provider    : ${existing?.provider ?? "not set"}`);
    info(`Model       : ${existing?.model ?? "not set"}`);
    info(
        `API key     : ${existing?.apiKey ? "***" + existing.apiKey.slice(-4) : "not set"}`
    );
    info(
        `GitHub token: ${existing?.githubToken ? "***" + existing.githubToken.slice(-4) : "not set"}`
    );
    info(`Mode        : ${existing?.isLocal ? "local" : "cloud"}`);
    info(`Local URL   : ${existing?.localUrl || "not set"}`);
    info(`Local model : ${existing?.localModel || "not set"}`);

    const updateKey = await prompt("\nUpdate API key? (leave blank to skip): ");
    if (updateKey) {
        saveApiKey(updateKey);
        success("API key updated!");
    }

    const updateGithub = await prompt(
        "Update GitHub token? (leave blank to skip): "
    );
    if (updateGithub) {
        saveGithubToken(updateGithub);
        success("GitHub token updated!");
    }
}
