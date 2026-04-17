import { Command } from "commander";
import { runAsk } from "./commands/ask";
import { runHistory } from "./commands/history";
import { runCheck } from "./commands/check";
import { runUpdate } from "./commands/update";
import { runStatus } from "./commands/status";
import { runConfig } from "./commands/config";
import {
    checkNodeVersion,
    checkIsRepo,
    checkAlreadyIndexed,
    promptApiKey,
    promptGithubToken,
    createFolder,
    runFullIndexPipeline,
    printSummary,
} from "./commands/init";
import { saveApiKey, saveGithubToken } from "./config/keys";

const program = new Command();

program
    .name("archaeo")
    .description("Query your git history in plain English")
    .version("1.0.0");

program
    .command("init")
    .description("Index the current repository")
    .action(async () => {
        if (!(await checkNodeVersion())) return;
        if (!(await checkIsRepo())) return;

        if (await checkAlreadyIndexed()) {
            console.log("Already indexed. Run: archaeo update");
            return;
        }

        const apiKey = await promptApiKey();
        if (!apiKey) {
            console.log("API key required.");
            return;
        }
        saveApiKey(apiKey);

        const githubToken = await promptGithubToken();
        if (githubToken) saveGithubToken(githubToken);

        createFolder();
        await runFullIndexPipeline();
        printSummary();
    });

program
    .command("ask <question>")
    .description("Ask a question about your codebase history")
    .option("--json", "output as JSON")
    .option("--no-pr", "ignore PR descriptions")
    .option("--since <date>", "limit to commits after date")
    .action(async (question, options) => {
        await runAsk(question, options);
    });

program
    .command("history <file>")
    .description("Show history of a specific file")
    .action(async (file) => {
        await runHistory(file);
    });

program
    .command("check")
    .description("Check current changes for conflicts with past decisions")
    .action(async () => {
        await runCheck();
    });

program
    .command("update")
    .description("Index new commits since last run")
    .action(async () => {
        await runUpdate();
    });

program
    .command("status")
    .description("Show index stats")
    .action(async () => {
        await runStatus();
    });

program
    .command("config")
    .description("View and edit configuration")
    .option("--key <key>", "set Anthropic API key")
    .option("--github <token>", "set GitHub token")
    .action(async (options) => {
        await runConfig(options);
    });

export { program };
