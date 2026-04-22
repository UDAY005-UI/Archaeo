import fs from "fs";
import { FixContext } from "../types";
import path from "path";

const ERROR_REGEX = /(TypeError|ReferenceError|SyntaxError|Error): (.*)/;
const FILE_REGEX = /(\S+):(\d+):(\d+)/;
const ERROR_START = /(Error|TypeError|ReferenceError|SyntaxError)/;

const logPath = path.join(process.cwd(), ".archaeo", "error.log");

export function readError(): FixContext | null {
    if (!fs.existsSync(logPath)) return null;

    let content = fs.readFileSync(logPath, "utf-8");
    content = content.replace(/\x1b\[[0-9;]*m/g, "");

    const lines = content.split("\n");

    let startIndex = -1;

    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (line && ERROR_START.test(line)) {
            startIndex = i;
            break;
        }
    }

    if (startIndex === -1) return null;

    const block: string[] = [];

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        if (!line || line.trim() === "") break;
        block.push(line);
    }

    let message = "";
    let type = "";
    let file = "";
    let lineNum = 0;

    for (const l of block) {
        if (!message) {
            const m = l.match(ERROR_REGEX);
            if (m && m[1] && m[2]) {
                type = m[1];
                message = m[2];
            }
        }

        if (!file) {
            const f = l.match(FILE_REGEX);
            if (f && f[1] && f[2] && !f[1].includes("node_modules")) {
                file = f[1];
                lineNum = Number(f[2]);
            }
        }
    }

    if (!file) return null;

    const code = extractFunctionContext(file, lineNum);

    return {
        error: message,
        type,
        file,
        line: lineNum,
        code,
    };
}

const FUNCTION_HINT = /(function\s|\=\>\s*{|\)\s*{)/;

function fallback(lines: string[], line: number): string {
    const start = Math.max(0, line - 20);
    const end = Math.min(lines.length, line + 20);
    return lines.slice(start, end).join("\n");
}

export function extractFunctionContext(filePath: string, line: number): string {
    if (!fs.existsSync(filePath)) return "";

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    if (line <= 0 || line > lines.length) {
        return fallback(lines, line);
    }

    let start = line - 1;

    for (let i = line - 1; i >= 0; i--) {
        const l = lines[i];
        if (l && FUNCTION_HINT.test(l)) {
            start = i;
            break;
        }
    }

    let braceStart = start;
    while (braceStart >= 0) {
        const l = lines[braceStart];
        if (l && l.includes("{")) break;
        braceStart--;
    }

    if (braceStart < 0) {
        return fallback(lines, line);
    }

    let balance = 0;
    let end = braceStart;

    for (let i = braceStart; i < lines.length; i++) {
        const l = lines[i];
        if (!l) continue;

        if (l.includes("{")) balance++;
        if (l.includes("}")) {
            balance--;
            if (balance === 0) {
                end = i;
                break;
            }
        }
    }

    return lines.slice(braceStart, end + 1).join("\n");
}
