import path from "path";
import fs from "fs";
import simpleGit from "simple-git";
import { exitWithError } from "../utils/errors";
import { getFileHistory } from "../storage/graph.repo";
import { initDB } from "../storage/db";
import { info, printTimeline } from "../utils/display";

const git = simpleGit();

export async function resolveFilePath(filePath: string): Promise<string> {
    const repoRoot = (await git.revparse(["--show-toplevel"])).trim();
    const absPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(absPath)) {
        exitWithError(`File not found: ${filePath}`);
    }

    const relativePath = path.relative(repoRoot, absPath);

    if (relativePath.startsWith("..")) {
        exitWithError("File is outside the repository");
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
    }

    history.sort((a, b) => b.timestamp - a.timestamp);

    printTimeline(history);
}
