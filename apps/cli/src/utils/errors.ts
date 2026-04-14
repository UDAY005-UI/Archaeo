import chalk from "chalk";

export function isApiKeyError(error: unknown): boolean {
    const msg = toMessage(error);
    return (
        msg.includes("401") ||
        msg.toLowerCase().includes("api-key") ||
        msg.toLowerCase().includes("authentication")
    );
}

export function isRateLimitError(error: unknown): boolean {
    const msg = toMessage(error);
    return msg.includes("429") || msg.toLowerCase().includes("rate limit");
}

export function handleError(error: unknown): void {
    if (isApiKeyError(error)) {
        console.error(chalk.red("x Invalid or missing API key."));
        console.error(
            chalk.dim(" Set it with: export ANTHROPIC_KEY=sk-ant...")
        );
        console.error(
            chalk.dim(" Or run: codebase-why config --key <your-key>")
        );
        return;
    }

    if (isRateLimitError(error)) {
        console.error(chalk.red("x Rate limit hit."));
        console.error(
            chalk.dim(" Too many requests. Wait a minute and try again.")
        );
        return;
    }

    const msg = toMessage(error);
    console.error(chalk.red(`x ${msg}`));
}

export function exitWithError(error: unknown, exitCode = 1): never {
    handleError(error);
    process.exit(exitCode);
}

function toMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "An unexpected error occurred";
}
