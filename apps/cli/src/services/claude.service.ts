import { GoogleGenerativeAI } from "@google/generative-ai";
import {
    ClaudeAnswer,
    FixContext,
    Issue,
    RetrievalContext,
    SearchResult,
} from "../types";

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export function buildIssueCommandSystemPrompt(): string {
    return `You are an expert software engineer doing bug triage on a GitHub issue.
You will be given an issue title, description, comments, and relevant source files.

Your job is to:
1. Explain the bug in plain English — what is going wrong and why
2. List the probable files where the issue originates, in order of likelihood
3. Within each file, point to the specific functions or code blocks that are likely involved
4. Suggest what kind of change is needed (do not write the full fix — just direction)

Rules:
- Base your file and function suggestions strictly on the provided source files
- If a file is listed but seems unrelated, skip it
- Be concise — developers will use this as a starting point, not a final answer`;
}

export function buildAskCommandSystemPrompt(): string {
    return `You are a codebase historian. You have been given a set of git commits relevant to a developer's question.

Summarise what happened and explain the decisions and reasoning behind the changes. 
Do NOT list commit hashes — those are already shown to the user separately.
Focus on explaining the WHY and WHAT in plain English.`;
}

export function buildFixCommandSystemPrompt(): string {
    return `You are a senior software engineer specializing in debugging runtime errors.
You will be given a runtime error along with relevant source files and git history.

Your job is to:
1. Identify the exact root cause of the error
2. Point to the specific file, function, and line where the fix should be applied
3. Provide the corrected code snippet
4. Briefly explain why this fix works

Rules:
- Be precise, no vague suggestions
- Only suggest changes directly related to the error
- If multiple fixes are needed, list them in order of application
- Do not rewrite unrelated code`;
}

export function buildFileRetrievalSystemPrompt(): string {
    return `You are a code triaging assistant.
You will be given a GitHub issue and a list of file paths from the repository.
Return ONLY a JSON array of file paths that are most likely related to this issue. Max 5 files but there can be exceptions.
Do not explain. Do not add any text. Just the JSON array.
Example: ["src/auth/auth.service.ts", "src/auth/jwt.guard.ts"]`;
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

export function buildAskCommandUserMessage(context: RetrievalContext): string {
    const formattedResults = context.results.map(formatResult).join("\n\n");

    return `Developer question: ${context.question}

Relevant history:
${formattedResults}

Answer the question using only this history. Cite commits and PRs.`;
}

export function buildFixCommandUserMessage(context: string): string {
    return `${context}

Identify the root cause and provide the exact fix with corrected code.`;
}

export function buildIssueCommandUserMessage(context: string): string {
    return `${context}

Analyze the issue and based on the relevant files provided, explain the bug, identify the probable files and functions where the issue lies, and suggest what kind of change is needed.`;
}

export function buildFileRetrievalUserMessage(
    issue: Issue,
    tree: string[]
): string {
    return `Issue #${issue.number}: ${issue.title}

Description:
${issue.body}

Labels: ${issue.labels?.join(", ") || "none"}

Comments:
${issue.comments.join("\n\n")}

Repository file tree:
${tree.join("\n")}

Return a JSON array of the most relevant file paths.`;
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

export async function askCommandSynthesise(
    context: RetrievalContext
): Promise<ClaudeAnswer> {
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const prompt = `${buildAskCommandSystemPrompt()}\n\n${buildAskCommandUserMessage(context)}`;
    const result = await model.generateContent(prompt);
    const raw = result.response.text();

    parseAnswer(raw);

    return { answer: raw, sources: [], confidence: "high" };
}

export async function fixCommandSynthesise(
    context: string
): Promise<ClaudeAnswer> {
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const prompt = `${buildAskCommandSystemPrompt()}\n\n${buildFixCommandUserMessage(context)}`;
    const result = await model.generateContent(prompt);
    const raw = result.response.text();

    return { answer: raw, sources: [], confidence: "high" };
}

export async function issueCommandSynthesise(
    context: string
): Promise<ClaudeAnswer> {
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const prompt = `${buildAskCommandSystemPrompt()}\n\n${buildIssueCommandUserMessage(context)}`;
    const result = await model.generateContent(prompt);
    const raw = result.response.text();

    return { answer: raw, sources: [], confidence: "high" };
}

export async function getRelevantFiles(
    issue: Issue,
    tree: string[]
): Promise<string[]> {
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const prompt = `${buildFileRetrievalSystemPrompt()}\n\n${buildFileRetrievalUserMessage(issue, tree)}`;
    const result = await model.generateContent(prompt);
    const raw = result.response.text();

    try {
        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            throw new Error("Model output is not an array");
        }

        return parsed;
    } catch (err) {
        console.error("Failed to parse model output:", raw);

        return raw
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
    }
}
