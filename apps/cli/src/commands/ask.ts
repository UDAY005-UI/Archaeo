import path from "path";
import { initDB } from "../storage/db";
import { search } from "../services/retrieval.service";
import { askCommandSynthesise } from "../services/claude.service";
import { count } from "../storage/commits.repo";
import { getApiKey } from "../config/keys";
import { error, info, printAnswer } from "../utils/display";
import { AskOptions } from "../types";
import { exitWithError } from "../utils/errors";

export function validateQuestion(question: string): boolean {
    if (!question || question.trim().length === 0) {
        error("Please provide a question.");
        return false;
    }
    if (question.trim().length < 10) {
        error("Question is too short. Be more specific.");
        return false;
    }
    return true;
}

export function checkIndexExists(): boolean {
    const fs = require("fs");
    const indexPath = path.join(process.cwd(), ".archaeo", "index.db");
    if (!fs.existsSync(indexPath)) {
        error("No index found. Run: archaeo init");
        return false;
    }
    return true;
}

export async function runAsk(
    question: string,
    options: AskOptions
): Promise<void> {
    try {
        if (!validateQuestion(question)) return;
        if (!checkIndexExists()) return;

        const apiKey = getApiKey();
        if (!apiKey) {
            exitWithError(
                "No API key found. Set ANTHROPIC_API_KEY or run: archaeo config --key"
            );
        }

        const db = initDB(path.join(process.cwd(), ".archaeo", "index.db"));

        const total = count(db);
        if (total === 0) {
            exitWithError("Index is empty. Run: archaeo init");
        }

        info(`Searching ${total} commits...`);

        const context = await search(db, question);

        if (context.results.length === 0) {
            exitWithError("No relevant history found for this question.");
        }

        info(`Found ${context.results.length} relevant commits/PRs`);

        const answer = await askCommandSynthesise(context);

        if (options.json) {
            console.log(JSON.stringify(answer, null, 2));
            return;
        }

        const timeline = context.results
            .filter((r) => r.type === "commit")
            .slice(0, 10)
            .map((r) => ({
                hash: r.hash ?? "",
                message: r.message ?? "",
                author: r.author ?? "",
                timestamp: r.timestamp,
                type: "commit" as const,
            }));

        printAnswer(question, answer.answer, timeline);
    } catch (err) {
        error(`Failed to answer question: ${err}`);
        throw err;
    }
}
