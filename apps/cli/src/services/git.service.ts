import simpleGit from "simple-git";
import { Commit, Issue } from "../types";
import { execSync } from "child_process";

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
            files: await getCommitDiffFiles(c.hash),
            diff_summary: await getCommitDiff(c.hash),
        }))
    );

    return commits;
}

export async function getCommitDiff(hash: string): Promise<string> {
    try {
        const result = await git.show([hash, "-p", "--no-color"]);
        return result;
    } catch {
        return "";
    }
}

export async function getCommitDiffFiles(hash: string): Promise<string[]> {
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
    try {
        const git = simpleGit();
        const upstream = await git
            .remote(["get-url", "upstream"])
            .catch(() => null);
        if (upstream) return upstream.trim();
        const origin = await git
            .remote(["get-url", "origin"])
            .catch(() => null);
        return origin ? origin.trim() : null;
    } catch {
        return null;
    }
}

export async function getHeadHash(): Promise<string | null> {
    const log = await git.log({ maxCount: 1 });

    const latestHash = log.all[0]?.hash;

    if (!latestHash) return null;

    return latestHash;
}

function parseGitHubRemoteUrl(remoteUrl: string): {
    owner: string;
    repo: string;
} {
    const match = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);
    if (!match) throw new Error("Not a valid GitHub remote URL");

    if (match[1] === undefined || match[2] === undefined)
        throw new Error("Not a valid GitHub remote URL");
    return { owner: match[1], repo: match[2] };
}

export async function getOpenIssues(token?: string | null): Promise<Issue[]> {
    const remoteUrl = await getRemoteUrl();

    if (!remoteUrl || remoteUrl === null) return [];

    const { owner, repo } = parseGitHubRemoteUrl(remoteUrl);
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=100`,
        { headers }
    );

    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const issues = await res.json();
    return issues.filter((i: any) => !i.pull_request) as Issue[];
}

export function getFileTree(): string[] {
    const output = execSync("git ls-files").toString().trim();
    return output.split("\n").filter(Boolean);
}
