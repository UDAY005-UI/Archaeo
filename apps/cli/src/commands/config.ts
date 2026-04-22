import { readConfig, writeConfig } from "../config/global";
import {
    getApiKey,
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
}): Promise<void> {
    // update API key directly from flag
    if (options.key) {
        if (!validateKey(options.key)) {
            error("Invalid API key. Must start with sk-ant-");
            return;
        }
        saveApiKey(options.key);
        success("✔ API key saved!");
        return;
    }

    // update GitHub token directly from flag
    if (options.github) {
        if (!validateGithubToken(options.github)) {
            error("Invalid GitHub token. Must start with ghp_");
            return;
        }
        saveGithubToken(options.github);
        success("✔ GitHub token saved!");
        return;
    }

    const config = readConfig();

    info("Current config:");
    info(
        `API key     : ${config?.apiKey ? "***" + config.apiKey.slice(-4) : "not set"}`
    );
    info(
        `GitHub token: ${config?.githubToken ? "***" + config.githubToken.slice(-4) : "not set"}`
    );
    info(`Model       : ${config?.defaultModel ?? "not set"}`);
    info(`Max tokens  : ${config?.maxContextTokens ?? "not set"}`);

    const updateKey = await prompt("\nUpdate API key? (leave blank to skip): ");
    if (updateKey) {
        if (!validateKey(updateKey)) {
            error("Invalid API key.");
            return;
        }
        saveApiKey(updateKey);
        success("✔ API key updated!");
    }

    const updateGithub = await prompt(
        "Update GitHub token? (leave blank to skip): "
    );
    if (updateGithub) {
        if (!validateGithubToken(updateGithub)) {
            error("Invalid GitHub token.");
            return;
        }
        saveGithubToken(updateGithub);
        success("✔ GitHub token updated!");
    }
}
