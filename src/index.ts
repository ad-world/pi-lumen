import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { runForIntent, type LumenIntent } from "./domain.ts";
import { parseLumenIntent } from "./parse.ts";
import { ReviewPicker } from "./picker.ts";
import { ReviewFlow } from "./review-flow.ts";
import { LumenRunner } from "./runner.ts";
import { ReviewStateStore } from "./state.ts";

/** Register the `/lumen` command and wire its state, picker, runner, and review orchestration. */
export default function piLumen(pi: ExtensionAPI): void {
  const state = new ReviewStateStore();
  const picker = new ReviewPicker(pi, state);
  const flow = new ReviewFlow(pi, new LumenRunner(), state);

  pi.registerCommand("lumen", {
    description: "Open Lumen diff/PR review; press s in Lumen to feed annotations back to the agent",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      await ctx.waitForIdle();

      const intent = await resolveIntent(picker, ctx, args);
      if (!intent) return;

      await flow.execute(ctx, runForIntent(intent));
    },
  });
}

/** Convert slash-command args into a typed Lumen intent, using the picker when no args are supplied. */
async function resolveIntent(picker: ReviewPicker, ctx: ExtensionCommandContext, args: string): Promise<LumenIntent | undefined> {
  const trimmed = args.trim();
  if (trimmed && trimmed !== "pr") return parseLumenIntent(trimmed);

  const target = await picker.pick(ctx, { prOnly: trimmed === "pr" });
  return target ? { kind: "review", target } : undefined;
}
