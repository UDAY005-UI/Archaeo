import { Octokit } from "@octokit/rest";
import { getGithubToken } from "../config/keys";
import { PullRequest } from "../types";

function getOctokit(): Octokit {
    const token = getGithubToken();
    return new Octokit({ auth: token ?? undefined });
}

export function parseOwnerRepo(
    remoteUrl: string
): { owner: string; repo: string } | null {
    const httpsMatch = remoteUrl.match(
        /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/
    );
    const sshMatch = remoteUrl.match(
        /github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/
    );

    const match = httpsMatch ?? sshMatch;
    if (!match) return null;

    const owner = match[1];
    const repo = match[2];

    if (!owner || !repo) return null;

    return { owner, repo };
}

export async function fetchAllPRs(
    owner: string,
    repo: string
): Promise<PullRequest[]> {
    try {
        const octokit = getOctokit();

        const prs = await octokit.paginate(octokit.rest.pulls.list, {
            owner,
            repo,
            state: "closed",
            per_page: 100,
        });

        return prs
            .filter((pr) => pr.merged_at !== null)
            .map((pr) => ({
                number: pr.number,
                title: pr.title,
                description: pr.body ?? undefined,
                author: pr.user?.login ?? undefined,
                merged_at: pr.merged_at
                    ? new Date(pr.merged_at).getTime()
                    : undefined,
                commits: [],
                files: [],
            }));
    } catch (err) {
        console.error("Failed to fetch PRs:", err);
        throw err;
    }
}

export async function fetchPRCommits(
    owner: string,
    repo: string,
    prNumber: number
): Promise<string[]> {
    try {
        const octokit = getOctokit();

        const commits = await octokit.paginate(octokit.rest.pulls.listCommits, {
            owner,
            repo,
            pull_number: prNumber,
            per_page: 100,
        });

        return commits.map((c) => c.sha);
    } catch (err) {
        console.error(`Failed to fetch commits for PR #${prNumber}:`, err);
        throw err;
    }
}

export async function linkPRsToCommits(
    prs: PullRequest[],
    owner: string,
    repo: string
): Promise<PullRequest[]> {
    try {
        const linked = await Promise.all(
            prs.map(async (pr) => {
                const commitHashes = await fetchPRCommits(
                    owner,
                    repo,
                    pr.number
                );
                return {
                    ...pr,
                    commits: commitHashes,
                };
            })
        );

        return linked;
    } catch (err) {
        console.error("Failed to link PRs to commits:", err);
        throw err;
    }
}
