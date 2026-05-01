import path from "path";
import fs from "fs";
import simpleGit from "simple-git";
import { exitWithError } from "../utils/errors";
import { getFileHistory } from "../storage/graph.repo";
import { initDB } from "../storage/db";
import { info, printTimeline } from "../utils/display";
import chalk from "chalk";

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

    for (const h of history) {
        const date = new Date(h.entry.timestamp).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });

        const hash = String(h.entry.entity_id).slice(0, 7);
        const border = chalk.dim("─".repeat(60));

        console.log(`\n${border}`);
        console.log(`${chalk.yellow("●")} ${chalk.bold(h.message)}`);
        console.log(
            `  ${chalk.dim(date)} · ${chalk.cyan(hash)} · ${chalk.magenta("@" + (h.entry.author ?? "unknown"))}`
        );

        if (h.diff) {
            console.log();
            const lines = h.diff
                .split("\n")
                .filter((line) => line.startsWith("+") || line.startsWith("-"))
                .filter(
                    (line) => !line.startsWith("+++") && !line.startsWith("---")
                );

            for (const line of lines) {
                if (line.startsWith("+")) {
                    console.log(chalk.green(line));
                } else {
                    console.log(chalk.red(line));
                }
            }
        }

        console.log(`${border}\n`);
    }
}
