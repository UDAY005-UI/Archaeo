import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { ClaudeAnswer, Issue, RetrievalContext, SearchResult } from "../types";
import { readConfig } from "../config/global";

export async function callAI(prompt: string, system: string): Promise<string> {
    const config = readConfig();

    if (config?.isLocal) {
        if (!config.localUrl || !config.localModel) {
            throw new Error(
                "Local URL and model not set. Run: archaeo config --local-url <url> --local-model <model>"
            );
        }
        const client = new OpenAI({
            baseURL: `${config.localUrl}/v1`,
            apiKey: "local",
            timeout: 120_000,
        });
        const response = await client.chat.completions.create({
            model: config.localModel,
            messages: [
                { role: "system", content: system },
                { role: "user", content: prompt },
            ],
        });
        return response.choices[0]?.message?.content ?? "";
    }

    const provider = config?.provider ?? "gemini";

    if (provider === "gemini") {
        const client = new GoogleGenerativeAI(
            config?.apiKey ?? process.env.GEMINI_API_KEY ?? ""
        );
        const model = client.getGenerativeModel({
            model: config?.model ?? "gemini-2.5-flash-lite",
        });
        const result = await model.generateContent(`${system}\n\n${prompt}`);
        return result.response.text();
    }

    if (provider === "openai") {
        const client = new OpenAI({
            apiKey: config?.apiKey ?? process.env.OPENAI_API_KEY,
        });
        const response = await client.chat.completions.create({
            model: config?.model ?? "gpt-4o-mini",
            messages: [
                { role: "system", content: system },
                { role: "user", content: prompt },
            ],
        });
        return response.choices[0]?.message?.content ?? "";
    }

    if (provider === "anthropic") {
        const client = new Anthropic({
            apiKey: config?.apiKey ?? process.env.ANTHROPIC_API_KEY,
        });
        const response = await client.messages.create({
            model: config?.model ?? "claude-3-5-haiku-20241022",
            max_tokens: 1000,
            system,
            messages: [{ role: "user", content: prompt }],
        });
        return (response.content[0] as any).text ?? "";
    }

    throw new Error(
        `Unknown provider: ${provider}. Run: archaeo config --provider gemini|openai|anthropic`
    );
}

export function buildParseQuestionPrompt(
    question: string,
    fileTree: string[]
): string {
    return `You are a code repository analyst.
You will be given a developer's question and a list of file paths from the repository.

Return a JSON object with exactly this shape:
{
    "files": ["path/to/file.ts"],
    "keywords": ["auth", "jwt"]
}

Rules:
- files: most relevant file paths from the tree. Max 5. Empty array if none.
- keywords: key domain terms from the question for commit matching. Max 5.
- Return ONLY the JSON object. No explanation. No markdown. No backticks.

Question: ${question}

File tree:
${fileTree.join("\n")}`;
}

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
    return `You are a codebase historian. Answer the developer's question directly using only the provided git history.

Rules:
- Answer as concisely as the question allows — simple questions get short answers, complex questions get detailed ones
- No filler, no unnecessary background, no restating the question
- Only include information directly relevant to what was asked
- If the history doesn't contain enough information to answer, say so explicitly in one sentence
- At the end, add a "Relevant Commits:" section in this format:
- <hash> | <date> | <message>`;
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
    const date = new Date(result.timestamp).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    if (result.type === "commit") {
        return [
            `Commit: ${result.hash}`,
            `Date: ${date}`,
            `Author: ${result.author}`,
            `Message: ${result.message}`,
            `Files: ${result.files.join(", ")}`,
        ].join("\n");
    } else {
        return [
            `PR #${result.number}: ${result.title}`,
            `Date: ${date}`,
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
    const raw = await callAI(
        buildAskCommandUserMessage(context),
        buildAskCommandSystemPrompt()
    );
    return parseAnswer(raw);
}

export async function fixCommandSynthesise(
    context: string
): Promise<ClaudeAnswer> {
    const raw = await callAI(
        buildFixCommandUserMessage(context),
        buildFixCommandSystemPrompt()
    );
    return { answer: raw, sources: [], confidence: "high" };
}

export async function issueCommandSynthesise(
    context: string
): Promise<ClaudeAnswer> {
    const raw = await callAI(
        buildIssueCommandUserMessage(context),
        buildIssueCommandSystemPrompt()
    );
    return { answer: raw, sources: [], confidence: "high" };
}

export async function getRelevantFiles(
    issue: Issue,
    tree: string[]
): Promise<string[]> {
    const raw = await callAI(
        buildFileRetrievalUserMessage(issue, tree),
        buildFileRetrievalSystemPrompt()
    );

    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            throw new Error("Model output is not an array");
        return parsed;
    } catch {
        return raw
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
    }
}
