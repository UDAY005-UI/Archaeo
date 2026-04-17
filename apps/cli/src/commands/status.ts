import path from "path";
import fs from "fs";
import { initDB } from "../storage/db";
import { count as commitCount } from "../storage/commits.repo";
import { count as prCount } from "../storage/prs.repo";
import { readLocalConfig } from "../config/local";
import { getRemoteUrl } from "../services/git.service";
import { printStats } from "../utils/display";

export async function runStatus(): Promise<void> {
    const indexPath = path.join(process.cwd(), ".archaeo", "index.db");

    if (!fs.existsSync(indexPath)) {
        console.log("No index found. Run: archaeo init");
        return;
    }

    const db = initDB(indexPath);
    const config = readLocalConfig();
    const dbSizeBytes = fs.statSync(indexPath).size;
    const remoteUrl = await getRemoteUrl();

    printStats({
        commitCount: commitCount(db),
        prCount: prCount(db),
        lastIndexed: config?.indexedAt ?? "unknown",
        dbSizeBytes,
        repoRemoteUrl: remoteUrl ?? undefined,
    });
}
