import Database from "better-sqlite3";
import { searchCommits, searchPRs } from "../storage/vectors.repo";
import { QuestionType, RetrievalContext, SearchResult } from "../types";
import { generateQuestionVector } from "./embedder.service";
import { estimateTokens } from "../utils/tokens";
import { callAI, buildParseQuestionPrompt } from "./ai.service";

export async function parseQuestion(
    question: string,
    fileTree: string[]
): Promise<{ files: string[]; keywords: string[] }> {
    const raw = await callAI(buildParseQuestionPrompt(question, fileTree), "");

    try {
        const parsed = JSON.parse(raw);
        return {
            files: parsed.files ?? [],
            keywords: parsed.keywords ?? [],
        };
    } catch {
        return { files: [], keywords: [] };
    }
}

export async function vectorSearch(
    db: Database.Database,
    question: string,
    fileTree: string[]
): Promise<SearchResult[]> {
    const vector = await generateQuestionVector(
        question,
        (await parseQuestion(question, fileTree)).files
    );

    const commits = searchCommits(db, vector, 20);
    const prs = searchPRs(db, vector, 10);

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

export async function search(
    db: Database.Database,
    question: string,
    fileTree: string[]
): Promise<RetrievalContext> {
    const parsedQuestion = await parseQuestion(question, fileTree);

    const rawResults = await vectorSearch(db, question, fileTree);

    const trimmed = trimToBudget(rawResults);

    const totalTokens = trimmed.reduce((sum, r) => {
        const text = `${r.message ?? r.title} ${r.description ?? ""} ${r.files.join(" ")}`;
        return sum + estimateTokens(text);
    }, 0);

    return {
        question,
        keywords: parsedQuestion.keywords,
        files: parsedQuestion.files,
        results: trimmed,
        totalTokens,
    };
}
