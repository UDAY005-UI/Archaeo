import path from "path";
import { initDB } from "../storage/db";
import { detectConflicts } from "../services/conflict.service";
import { printConflict, success, info } from "../utils/display";

export async function runCheck(): Promise<void> {
    try {
        const fs = await import("fs");
        const indexPath = path.join(process.cwd(), ".archaeo", "index.db");
        if (!fs.existsSync(indexPath)) {
            info("No index found. Run: archaeo init");
            return;
        }

        const db = initDB(indexPath);

        info("Checking current changes against history...");

        const warnings = await detectConflicts(db);

        if (warnings.length === 0) {
            success("✔ No conflicts detected. Your changes look good!");
            return;
        }

        info(`Found ${warnings.length} potential conflict(s):\n`);

        for (const warning of warnings) {
            printConflict(
                `File: ${warning.file}\n` +
                    `Current change: ${warning.currentChange}\n` +
                    `Conflicts with PR #${warning.conflictingPR.number}: "${warning.conflictingPR.title}"\n` +
                    `Original reason: ${warning.conflictingPR.reason}`
            );
        }
    } catch (err) {
        info(`Failed to check conflicts: ${err}`);
        throw err;
    }
}
