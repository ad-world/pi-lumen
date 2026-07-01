import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { LumenRun, ReviewRun } from "./domain.ts";
import { LumenRunner } from "./runner.ts";
import { ReviewStateStore } from "./state.ts";

/** Coordinates Lumen execution, review history persistence, and annotation reinjection into Pi. */
export class ReviewFlow {
  constructor(
    private readonly pi: ExtensionAPI,
    private readonly runner: LumenRunner,
    private readonly state: ReviewStateStore,
  ) {}

  /** Execute a typed Lumen run; review runs capture annotations, passthrough runs only report failures. */
  async execute(ctx: ExtensionCommandContext, run: LumenRun): Promise<void> {
    const result = await this.runner.run(ctx, run.kind === "review" ? run.review.command : run.command);

    if (result.error) {
      ctx.ui.notify(`pi-lumen: ${result.error}`, "error");
      return;
    }

    if (run.kind !== "review") {
      this.notifyPassthroughResult(ctx, result.code);
      return;
    }

    const annotations = extractAnnotations(result.stdout);
    const annotationCount = countAnnotations(annotations);
    await this.recordReview(ctx, run.review, annotationCount, result.code);

    if (annotations) {
      ctx.ui.notify(`Lumen captured ${annotationCount || 1} annotation${annotationCount === 1 ? "" : "s"}; prefilled input`, "info");
      ctx.ui.setEditorText(annotationPrompt(run.review, annotations));
    } else {
      ctx.ui.notify("Lumen review closed with no annotations sent", "info");
    }
  }

  private async recordReview(ctx: ExtensionCommandContext, review: ReviewRun, annotationCount: number, exitCode: number | null): Promise<void> {
    const warn = (message: string) => ctx.ui.notify(message, "warning");
    await this.state.upsert(
      {
        key: review.key,
        label: review.label,
        target: review.intent.target,
        cwd: ctx.cwd,
        viewedAt: Date.now(),
        ...(annotationCount > 0 ? { annotations: annotationCount } : {}),
      },
      warn,
    );

    this.pi.appendEntry("lumen.review", {
      command: review.command.display,
      key: review.key,
      label: review.label,
      annotations: annotationCount,
      exitCode,
    });
  }

  private notifyPassthroughResult(ctx: ExtensionCommandContext, code: number | null): void {
    if (code && code !== 0) ctx.ui.notify(`Lumen exited with code ${code}`, "warning");
  }
}

function extractAnnotations(stdout: string): string {
  const cleaned = stripTerminalSequences(stdout)
    .replace(/\r/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  const content = cleaned
    .split("\n")
    .filter((line) => !isLumenStatusLine(line.trim()))
    .join("\n")
    .trim();

  if (!content) return "";

  const annotationBlocks = content
    .split(/\n\s*---\s*\n/)
    .map((block) => block.trim())
    .filter(hasAnnotationLocation);

  return annotationBlocks.join("\n---\n").trim();
}

function stripTerminalSequences(text: string): string {
  return text
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, "")
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

function isLumenStatusLine(line: string): boolean {
  return /^[⠋⠙⠹⠸⠼⠴⠦⠧✓]\s+(?:Fetching|Fetched|Syncing|\d+ files? marked as viewed\b)/.test(line);
}

function hasAnnotationLocation(block: string): boolean {
  return block.split("\n").some((line) => /^\s*(?:\*\*)?.+?(?:\*\*)?\s+line\s+\d+\s+\((?:LEFT|RIGHT)\)\s*$/i.test(line));
}

function countAnnotations(stdout: string): number {
  const trimmed = stdout.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\n---\n/).filter(hasAnnotationLocation).length;
}

function annotationPrompt(_review: ReviewRun, annotations: string): string {
  return annotations.trim();
}
