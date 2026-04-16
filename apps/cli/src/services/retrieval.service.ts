import Database from "better-sqlite3";
import { searchCommits, searchPRs } from "../storage/vectors.repo";
import { QuestionType, RetrievalContext, SearchResult } from "../types";
import { generateQuestionVector } from "./embedder.service";
import { estimateTokens } from "../utils/tokens";

export function parseQuestion(question: string): {
    questionType: QuestionType;
    fileHints: string[];
} {
    const lower = question.toLowerCase();
    let questionType: QuestionType = "what"; // default
    if (lower.startsWith("why")) questionType = "why";
    if (lower.startsWith("when")) questionType = "when";
    if (lower.startsWith("who")) questionType = "who";
    if (lower.includes("history")) questionType = "history";

    const fileHints: string[] = [];
    const tsFiles = question.match(/[\w-]+\.ts/g) ?? [];
    const srcPaths = question.match(/src\/[\w/]+/g) ?? [];
    fileHints.push(...tsFiles, ...srcPaths);

    return { questionType, fileHints };
}

export async function vectorSearch(
    db: Database.Database,
    question: string
): Promise<SearchResult[]> {
    const vector = await generateQuestionVector(question);

    const commits = searchCommits(db, vector, 50);
    const prs = searchPRs(db, vector, 20);

    return [...commits, ...prs];
}

export function trimToBudget(results: SearchResult[]): SearchResult[] {
    const MAX_TOKENS = 80000;
    let usedTokens = 0;
    const selected: SearchResult[] = [];

    for (const result of results) {
        const text = `${result.message ?? result.title} ${result.description ?? ""} ${result.files.join(" ")}`;
        const tokens = estimateTokens(text);

        if (usedTokens + tokens > MAX_TOKENS) break;

        selected.push(result);
        usedTokens += tokens;
    }

    return selected;
}

export function rerank(
    results: SearchResult[],
    fileHints: string[],
    questionType: QuestionType
): SearchResult[] {
    const scored = results.map((result) => {
        let score = result.similarity;

        const fileOverlap = fileHints.filter((f) => result.files.includes(f));
        score += fileOverlap.length * 0.15;

        const ageMonths =
            (Date.now() - result.timestamp * 1000) / (30 * 24 * 3600 * 1000);
        score += Math.max(0, 0.1 - ageMonths * 0.005);

        if ((result.message?.length ?? 0) > 100) score += 0.08;

        if (/^chore|^bump|^deps/i.test(result.message ?? "")) score -= 0.2;

        return { ...result, score };
    });

    return scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
export async function search(
    db: Database.Database,
    question: string
): Promise<RetrievalContext> {
    const { questionType, fileHints } = parseQuestion(question);

    const rawResults = await vectorSearch(db, question);

    const ranked = rerank(rawResults, fileHints, questionType);

    const trimmed = trimToBudget(ranked);

    const totalTokens = trimmed.reduce((sum, r) => {
        const text = `${r.message ?? r.title} ${r.description ?? ""} ${r.files.join(" ")}`;
        return sum + estimateTokens(text);
    }, 0);

    return {
        question,
        questionType,
        fileHints,
        results: trimmed,
        totalTokens,
    };
}
