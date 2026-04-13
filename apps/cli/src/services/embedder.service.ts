import { pipeline, FeatureExtractionPipeline } from "@xenova/transformers";
import { Commit, PullRequest } from "../types";

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
    try {
        const embeddedText = buildCommitEmbeddingText(commit);

        const model = await loadModel();
        const output = await model(embeddedText, {
            pooling: "mean",
            normalize: true,
        });

        const vector = Array.from(output.data);

        return vector;
    } catch (err) {
        console.error("Failed to generate commit vector:", err);
        throw err;
    }
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
    try {
        const embeddedText = buildPrEmbeddingText(pr);

        const model = await loadModel();
        const output = await model(embeddedText, {
            pooling: "mean",
            normalize: true,
        });

        const vector = Array.from(output.data);

        return vector;
    } catch (err) {
        console.error("Failed to generate pull request vector:", err);
        throw err;
    }
}

export async function generateQuestionVector(
    question: string
): Promise<number[]> {
    try {
        const model = await loadModel();
        const output = await model(question, {
            pooling: "mean",
            normalize: true,
        });

        const vector = Array.from(output.data);

        return vector;
    } catch (err) {
        console.error("Failed to generate pull request vector:", err);
        throw err;
    }
}
