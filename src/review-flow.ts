import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { countAnnotations, extractAnnotations } from "./annotations.ts";
import type { LumenCommand } from "./command.ts";
import { LumenRunner } from "./runner.ts";

/** Runs Lumen diff review and pre-fills Pi's input with exported annotations. */
export class ReviewFlow {
  constructor(private readonly runner: LumenRunner) {}

  async execute(ctx: ExtensionCommandContext, command: LumenCommand): Promise<void> {
    const result = await this.runner.run(ctx, command);

    if (result.error) {
      ctx.ui.notify(`pi-lumen-review: ${result.error}`, "error");
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
    ctx.ui.notify(
      `Lumen captured ${annotationCount || 1} annotation${annotationCount === 1 ? "" : "s"}; prefilled input`,
      "info",
    );
    ctx.ui.setEditorText(annotations);
  }
}
