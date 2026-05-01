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
    const comments = Array.isArray(issue.comments)
        ? issue.comments
              .map((c: any) => (typeof c === "string" ? c : c.body))
              .join("\n\n")
        : "";

    return `Issue #${issue.number}: ${issue.title}

Labels: ${issue.labels?.join(", ") || "none"}

Description:
${issue.body}

Comments:
${comments}

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
                "No API key found. Set API_KEY or run: archaeo config --key"
            );
        }

        const total = count(db);

        if (total === 0) {
            exitWithError(
                "No issues indexed. Make sure your repo has open issues and run: archaeo init"
            );
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
