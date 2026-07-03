import { spawn, spawnSync } from "node:child_process";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { LumenCommand } from "./command.ts";

export type LumenResult = { code: number | null; stdout: string; error?: string };

type TuiHandle = { stop(): void; start(): void; requestRender(force?: boolean): void };

/** Runs Lumen as a child process, suspending Pi's TUI when an interactive terminal is available. */
export class LumenRunner {
  /** Execute a Lumen command and capture stdout, which Lumen uses for annotation export. */
  async run(ctx: ExtensionCommandContext, command: LumenCommand): Promise<LumenResult> {
    if (ctx.mode !== "tui") return this.spawn(ctx.cwd, command, false);

    return ctx.ui.custom<LumenResult>((tui, _theme, _kb, done) => {
      const result = this.runWithSuspendedTui(tui, ctx.cwd, command);
      done(result);
      return { render: () => [], invalidate: () => {} };
    });
  }

  private runWithSuspendedTui(tui: TuiHandle, cwd: string, command: LumenCommand): LumenResult {
    tui.stop();
    try {
      process.stdout.write("\x1b[2J\x1b[H");
      process.stdout.write(`Running ${command.display}\n`);
      process.stdout.write(
        "Annotate with i, open annotations with I, press s to prefill Pi's input.\n\n",
      );
      return this.spawnInteractive(cwd, command);
    } finally {
      tui.start();
      tui.requestRender(true);
    }
  }

  private spawn(
    cwd: string,
    command: LumenCommand,
    inheritTerminal: boolean,
  ): Promise<LumenResult> {
    if (inheritTerminal) return Promise.resolve(this.spawnInteractive(cwd, command));

    return new Promise((resolve) => {
      let stdout = "";
      const child = spawn(command.program, command.args, {
        cwd,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      child.stdout?.setEncoding("utf8");
      child.stdout?.on("data", (chunk: string) => {
        stdout += chunk;
        process.stdout.write(chunk);
      });

      child.stderr?.setEncoding("utf8");
      child.stderr?.on("data", (chunk: string) => process.stderr.write(chunk));

      child.on("error", (error) => resolve({ code: null, stdout, error: this.errorHint(error) }));
      child.on("close", (code) => resolve({ code, stdout }));
    });
  }

  private spawnInteractive(cwd: string, command: LumenCommand): LumenResult {
    const result = spawnSync(command.program, command.args, {
      cwd,
      env: process.env,
      stdio: ["inherit", "pipe", "inherit"],
      encoding: "utf8",
    });

    return {
      code: result.status,
      stdout: result.stdout ?? "",
      error: result.error ? this.errorHint(result.error) : undefined,
    };
  }

  private errorHint(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("ENOENT") || message.includes("not found")
      ? "lumen is not installed or not on PATH. Install with `brew install jnsahaj/lumen/lumen` or `cargo install lumen`."
      : message;
  }
}
