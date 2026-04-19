import simpleGit from "simple-git";
import { Commit } from "../types";

const git = simpleGit();

export async function getAllCommits(since?: number): Promise<Commit[]> {
    const args = since
        ? [`--after=${new Date(since).toISOString().split("T")[0]}`]
        : [];
    const result = await git.log(args);

    const commits = await Promise.all(
        result.all.map(async (c) => ({
            hash: c.hash,
            message: c.message,
            author: c.author_name,
            timestamp: new Date(c.date).getTime(),
            files: await getCommitDiff(c.hash), // ← fetch real files
        }))
    );

    return commits;
}

export async function getCommitDiff(hash: string): Promise<string[]> {
    try {
        const diffSummary = await git.diffSummary([`${hash}^!`]);
        return diffSummary.files.map((f) => f.file);
    } catch {
        return [];
    }
}

export async function getCurrentDiff(): Promise<{
    unstaged: string;
    staged: string;
}> {
    const unstaged = await git.diff();
    const staged = await git.diff(["--cached"]);

    return {
        unstaged,
        staged,
    };
}

export async function getFileCommits(filePath: string): Promise<Commit[]> {
    const log = await git.log({
        file: filePath,
    });

    return log.all.map((c) => ({
        hash: c.hash,
        message: c.message,
        author: c.author_name,
        timestamp: new Date(c.date).getTime(),
        files: [],
    }));
}

export async function getRemoteUrl(): Promise<string | null> {
    const url = await git.remote(["get-url", "origin"]);
    return url?.trim() ?? null; // add .trim()
}

export async function getHeadHash(): Promise<string | null> {
    const log = await git.log({ maxCount: 1 });

    const latestHash = log.all[0]?.hash;

    if (!latestHash) return null;

    return latestHash;
}
