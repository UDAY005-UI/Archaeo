import fs from "fs";
import path from "path";

const GITIGNORE_PATH = path.join(process.cwd(), ".gitignore");

export function readGitignore(): string[] {
    if (!fs.existsSync(GITIGNORE_PATH)) return [];
    const content = fs.readFileSync(GITIGNORE_PATH, "utf-8");
    return content
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("#"));
}

export function isInGitignore(entry: string): boolean {
    return readGitignore().includes(entry);
}

export function addToGitignore(entry: string): void {
    if (isInGitignore(entry)) return;
    fs.appendFileSync(GITIGNORE_PATH, `\n${entry}\n`, "utf-8");
}
