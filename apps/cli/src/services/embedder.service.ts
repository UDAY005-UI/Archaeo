import os from "os";
import path from "path";
import { env, pipeline, FeatureExtractionPipeline } from "@xenova/transformers";
import { Commit, PullRequest } from "../types";

env.cacheDir = path.join(os.homedir(), ".archaeo", "models");

let extractor: FeatureExtractionPipeline | null = null;

export async function loadModel(): Promise<FeatureExtractionPipeline> {
    if (!extractor) {
        extractor = await pipeline(
            "feature-extraction",
            "Xenova/all-MiniLM-L6-v2"
        );
    }
    return extractor;
}

export async function embed(text: string): Promise<number[]> {
    const model = await loadModel();
    const output = await model(text, { pooling: "mean", normalize: true });
    return Array.from(output.data);
}

export function buildCommitEmbeddingText(commit: Commit): string {
    return [
        `Commit: ${commit.message}`,
        `Author: ${commit.author}`,
        `Files: ${commit.files.join(", ")}`,
        `Summary: ${commit.diff_summary ?? ""}`,
    ].join("\n");
}

export async function generateCommitVector(commit: Commit): Promise<number[]> {
    const text = buildCommitEmbeddingText(commit);
    return embed(text);
}

export function buildPrEmbeddingText(pr: PullRequest): string {
    return [
        `Title: ${pr.title}`,
        `Description: ${pr.description}`,
        `Author: ${pr.author}`,
        `Commits: ${pr.commits.join(", ")}`,
        `Files: ${pr.files.join(", ")}`,
    ].join("\n");
}

export async function generatePrVector(pr: PullRequest): Promise<number[]> {
    const text = buildPrEmbeddingText(pr);
    return embed(text);
}

export async function generateQuestionVector(
    question: string,
    files: string[]
): Promise<number[]> {
    const text = `${question}\nFiles: ${files.join(", ")}`;
    return embed(text);
}

export async function generateQueryVector(question: string): Promise<number[]> {
    return embed(question);
}

export function estimateTime(commitCount: number): number {
    return commitCount * 100;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];

    for (const text of texts) {
        results.push(await embed(text));
        await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return results;
}
