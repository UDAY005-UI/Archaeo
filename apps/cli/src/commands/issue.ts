import path from "path";
import { initDB } from "../storage/db";
import { issueCommandSynthesise } from "../services/ai.service";
import { getApiKey } from "../config/keys";
import { error, info } from "../utils/display";
import { exitWithError } from "../utils/errors";
import { findByNumber } from "../storage/issues.repo";
import { count } from "../storage/issues.repo";
import { Issue } from "../types";
import { getGithubToken } from "../config/keys";
import { getFileTree } from "../services/git.service";
import { getRelevantFiles } from "../services/ai.service";

export function buildIssueContext(issue: Issue, files: string[]): string {
    return `Issue #${issue.number}: ${issue.title}

Labels: ${issue.labels?.join(", ") || "none"}

Description:
${issue.body}

Comments:
${issue.comments.join("\n\n")}

Relevant files:
${files.join("\n")}
`;
}

export async function runIssue(number: number): Promise<void> {
    try {
        const db = initDB(path.join(process.cwd(), ".archaeo", "index.db"));

        const apiKey = getApiKey();
        if (!apiKey) {
            exitWithError(
                "No API key found. Set ANTHROPIC_API_KEY or run: archaeo config --key"
            );
        }

        const total = count(db);

        if (total === 0) {
            exitWithError("Index is empty. Run: archaeo init");
        }

        const issue = findByNumber(db, number);

        if (!issue) {
            exitWithError("Provided issue doesn't exist");
        }

        info(`Searching issue ${number}...`);

        const githubToken = getGithubToken();
        const fileTree = await getFileTree();
        const files = await getRelevantFiles(issue, fileTree);
        const context = buildIssueContext(issue, files);
        const answer = await issueCommandSynthesise(context);

        console.log("\nIssue Analysis\n");
        console.log(answer.answer);
    } catch (err) {
        error(`Failed to explain the issue: ${err}`);
        throw err;
    }
}
