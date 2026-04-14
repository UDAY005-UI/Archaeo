import chalk from "chalk";
import boxen from "boxen";
import { TimelineEntry, IndexStats } from "../types";

export function success(msg: string): void {
    console.log(chalk.green(msg));
    return;
}

export function error(msg: string): void {
    console.log(chalk.red(msg));
    return;
}

export function warn(msg: string): void {
    console.log(chalk.yellow(msg));
    return;
}

export function info(msg: string): void {
    console.log(chalk.dim(msg));
    return;
}

export function printAnswer(
    question: string,
    answer: string,
    sources: string[]
): void {
    const output = sources.map((source) =>
        boxen(source, {
            padding: 1,
            margin: 1,
            borderStyle: "round",
        })
    );
    console.log(chalk.dim(question));
    console.log(answer);
    output.forEach((box) => console.log(box));
}

export function printConflict(message: string): void {
    const output = boxen(message, {
        padding: 1,
        margin: 1,
        borderStyle: "single",
        borderColor: "red",
    });

    console.log(output);
}

export function printTimeline(entries: TimelineEntry[]): void {
    entries.forEach((entry) => {
        const date = new Date(entry.timestamp * 1000).toLocaleDateString();
        console.log(chalk.dim(`── ${date}  @${entry.author}`));
        console.log(
            `   ${entry.message} ${chalk.dim(`(${entry.hash.slice(0, 7)})`)}`
        );
        console.log();
    });
}

export function printStats(stats: IndexStats): void {
    info(`Commits indexed : ${stats.commitCount}`);
    info(`PRs indexed     : ${stats.prCount}`);
    info(`Last indexed    : ${stats.lastIndexed}`);
    info(`Database size : ${(stats.dbSizeBytes / 1024 / 1024).toFixed(2)} MB`);
    info(`Remote URL   : ${stats.repoRemoteUrl}`);
}
