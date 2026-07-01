import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { diffCommand } from "./command.ts";
import { ReviewFlow } from "./review-flow.ts";
import { LumenRunner } from "./runner.ts";

/** Register `/lumen` as a thin `lumen diff ...` review helper. */
export default function piLumen(pi: ExtensionAPI): void {
  const flow = new ReviewFlow(new LumenRunner());

  pi.registerCommand("lumen", {
    description: "Open Lumen diff review; captured annotations prefill Pi's input editor",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      await ctx.waitForIdle();
      await flow.execute(ctx, diffCommand(args));
    },
  });
}
