import path from "path";
import fs from "fs";
import simpleGit from "simple-git";
import { exitWithError } from "../utils/errors";
import { getFileHistory } from "../storage/graph.repo";
import { initDB } from "../storage/db";
import { findByHash } from "../storage/commits.repo";
import { info, printTimeline } from "../utils/display";
import { TimelineEntry } from "../types";

const git = simpleGit();

export async function resolveFilePath(filePath: string): Promise<string> {
    const repoRoot = (await git.revparse(["--show-toplevel"])).trim();

    const absFromRoot = path.resolve(repoRoot, filePath);
    const absFromCwd = path.resolve(process.cwd(), filePath);

    let absPath: string;
    if (fs.existsSync(absFromRoot)) {
        absPath = absFromRoot;
    } else if (fs.existsSync(absFromCwd)) {
        absPath = absFromCwd;
    } else {
        exitWithError(`File not found: ${filePath}`);
        process.exit(1);
    }

    const relativePath = path.relative(repoRoot, absPath);

    if (relativePath.startsWith("..")) {
        exitWithError("File is outside the repository");
        process.exit(1);
    }

    return relativePath;
}

export async function runHistory(filePath: string): Promise<void> {
    const db = initDB(path.join(process.cwd(), ".archaeo", "index.db"));

    info("Searching history...");

    const resolvedPath = await resolveFilePath(filePath);
    const history = getFileHistory(db, resolvedPath);

    if (!history) {
        exitWithError("No history found for this file.");
        return;
    }

    const timeline: TimelineEntry[] = history.map((entry) => {
        if (entry.entity_type === "commit") {
            const commit = findByHash(db, String(entry.entity_id));
            return {
                hash: String(entry.entity_id),
                message: commit?.message ?? "",
                author: commit?.author ?? "",
                timestamp: entry.timestamp,
                type: entry.entity_type,
            };
        }
        return {
            hash: String(entry.entity_id),
            message: "",
            author: "",
            timestamp: entry.timestamp,
            type: entry.entity_type,
        };
    });

    printTimeline(timeline);
}
