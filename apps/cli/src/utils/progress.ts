import ora from "ora";
import cliProgress from "cli-progress";

export function createSpinner(text: string) {
    return ora(text).start();
}

export function createBar(total: number) {
    const bar = new cliProgress.SingleBar({
        format: "Indexing... [{bar}] {value}/{total}",
        clearOnComplete: false,
        hideCursor: true,
    });
    bar.start(total, 0);
    return bar;
}

export function updateBar(bar: cliProgress.SingleBar, value: number): void {
    bar.update(value);
}

export function stopBar(bar: cliProgress.SingleBar): void {
    bar.stop();
}
