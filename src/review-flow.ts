import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { LumenCommand } from "./command.ts";
import { LumenRunner } from "./runner.ts";

/** Runs Lumen diff review and pre-fills Pi's input with exported annotations. */
export class ReviewFlow {
  constructor(private readonly runner: LumenRunner) {}

  async execute(ctx: ExtensionCommandContext, command: LumenCommand): Promise<void> {
    const result = await this.runner.run(ctx, command);

    if (result.error) {
      ctx.ui.notify(`pi-lumen: ${result.error}`, "error");
      return;
    }

    if (result.code && result.code !== 0) {
      ctx.ui.notify(`Lumen exited with code ${result.code}`, "warning");
    }

    const annotations = extractAnnotations(result.stdout);
    if (!annotations) {
      ctx.ui.notify("Lumen review closed with no annotations sent", "info");
      return;
    }

    const annotationCount = countAnnotations(annotations);
    ctx.ui.notify(`Lumen captured ${annotationCount || 1} annotation${annotationCount === 1 ? "" : "s"}; prefilled input`, "info");
    ctx.ui.setEditorText(annotations);
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

  return content
    .split(/\n\s*---\s*\n/)
    .map((block) => block.trim())
    .filter(hasAnnotationLocation)
    .join("\n---\n")
    .trim();
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
