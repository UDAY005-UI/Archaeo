import Database from "better-sqlite3";
import { initDB } from "./storage/db";
import { search } from "./services/retrieval.service";
import { synthesise } from "./services/claude.service";
import { detectConflicts } from "./services/conflict.service";
import * as gitService from "./services/git.service";
import * as githubService from "./services/github.service";
import path from "path";

export type Container = {
    db: Database.Database;
    search: (question: string) => ReturnType<typeof search>;
    detect: () => ReturnType<typeof detectConflicts>;
    git: typeof gitService;
    github: typeof githubService;
    synthesise: typeof synthesise;
};

export function buildContainer(): Container {
    const db = initDB(path.join(process.cwd(), ".archaeo", "index.db"));

    return {
        db,
        search: (question: string) => search(db, question),
        detect: () => detectConflicts(db),
        git: gitService,
        github: githubService,
        synthesise,
    };
}
