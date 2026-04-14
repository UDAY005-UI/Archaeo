export function estimateTokens(text: string): number {
    const tokens = text.length / 3.5;
    return Math.ceil(tokens);
}

export function fitsInBudget(text: string, budget: number): boolean {
    const tokens = estimateTokens(text);

    if (tokens <= budget) {
        return true;
    }

    return false;
}
