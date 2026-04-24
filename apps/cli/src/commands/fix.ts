import path from "path";
import { getApiKey } from "../config/keys";
import { error, info } from "../utils/display";
import { exitWithError } from "../utils/errors";
import { readError, extractFunctionContext } from "../services/error.service";
import { fixCommandSynthesise } from "../services/ai.service";
import { FixContext } from "../types";

export function buildFixContext(
    context: FixContext,
    functionCode: string
): string {
    return `Runtime error:
${context.type ? `${context.type}: ` : ""}${context.error}
${context.code ? `Error code: ${context.code}` : ""}

File: ${context.file}
Line: ${context.line}

Code:
\`\`\`
${functionCode}
\`\`\`
`;
}

export async function runFix(options: { json?: boolean }): Promise<void> {
    try {
        const apiKey = getApiKey();
        if (!apiKey) {
            exitWithError(
                "No API key found. Set GEMINI_API_KEY or run: archaeo config --key"
            );
        }

        const fixContext = readError();
        if (!fixContext) {
            exitWithError(
                "No error found. Make sure logs are redirected to .archaeo/error.log"
            );
        }

        const errorCode = extractFunctionContext(
            fixContext?.file,
            fixContext?.line
        );

        info(`Analyzing error in ${fixContext.file}:${fixContext.line}`);

        const context = buildFixContext(fixContext, errorCode);

        const answer = await fixCommandSynthesise(context);

        if (options.json) {
            console.log(JSON.stringify(answer, null, 2));
            return;
        }

        console.log("\nError Analysis\n");
        console.log(answer.answer);
    } catch (err) {
        error(`Failed to fix error: ${err}`);
        throw err;
    }
}
