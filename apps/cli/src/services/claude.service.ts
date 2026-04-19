import { GoogleGenerativeAI } from "@google/generative-ai";
import { ClaudeAnswer, RetrievalContext, SearchResult } from "../types";

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export function buildSystemPrompt(): string {
    return `You are a codebase historian. You have been given a curated set of git commits and PR descriptions relevant to a developer's question.

Rules:
1. Answer ONLY from the provided history. Do not invent or infer beyond it.
2. Cite every claim with a commit hash or PR number.
3. If the history doesn't contain enough information, say so explicitly.
4. Be concise. Developers want the answer, not a story.
5. Format: Answer paragraph first, then Sources list.`;
}

function formatResult(result: SearchResult): string {
    if (result.type === "commit") {
        return [
            `Commit: ${result.hash}`,
            `Author: ${result.author}`,
            `Message: ${result.message}`,
            `Files: ${result.files.join(", ")}`,
        ].join("\n");
    } else {
        return [
            `PR #${result.number}: ${result.title}`,
            `Author: ${result.author}`,
            `Description: ${result.description ?? "none"}`,
            `Files: ${result.files.join(", ")}`,
        ].join("\n");
    }
}

export function buildUserMessage(context: RetrievalContext): string {
    const formattedResults = context.results.map(formatResult).join("\n\n");

    return `Developer question: ${context.question}

Relevant history:
${formattedResults}

Answer the question using only this history. Cite commits and PRs.`;
}

export function parseAnswer(raw: string): ClaudeAnswer {
    let confidence: "high" | "medium" | "low" = "medium";
    if (
        raw.toLowerCase().includes("not enough") ||
        raw.toLowerCase().includes("no history")
    ) {
        confidence = "low";
    } else if (raw.includes("PR #") || raw.includes("Commit")) {
        confidence = "high";
    }

    const sources: ClaudeAnswer["sources"] = [];

    const commitMatches = raw.matchAll(/[a-f0-9]{7,40}/g);
    for (const match of commitMatches) {
        if (match[0]) {
            sources.push({ type: "commit", id: match[0], description: "" });
        }
    }

    const prMatches = raw.matchAll(/PR #(\d+)/g);
    for (const match of prMatches) {
        if (match[1]) {
            sources.push({ type: "pr", id: match[1], description: "" });
        }
    }

    return { answer: raw, sources, confidence };
}

export async function synthesise(
    context: RetrievalContext
): Promise<ClaudeAnswer> {
    try {
        const model = client.getGenerativeModel({
            model: "gemini-2.5-flash-lite",
        });
        const prompt = `${buildSystemPrompt()}\n\n${buildUserMessage(context)}`;
        const result = await model.generateContent(prompt);
        const raw = result.response.text();
        return parseAnswer(raw);
    } catch (err) {
        console.error("Failed to synthesise answer:", err);
        throw err;
    }
}
