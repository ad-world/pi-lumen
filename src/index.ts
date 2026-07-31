import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { diffCommand } from "./command.ts";
import { GhPullRequestDiffResolver } from "./pull-request-diff-resolver.ts";
import { pickPullRequest } from "./pull-request-picker.ts";
import { GhPullRequestProvider } from "./pull-requests.ts";
import { ReviewFlow } from "./review-flow.ts";
import { LumenRunner } from "./runner.ts";

/** Register `/lumen` as a Lumen diff review helper. */
export default function piLumen(pi: ExtensionAPI): void {
  const flow = new ReviewFlow(new LumenRunner());
  const pullRequests = new GhPullRequestProvider();
  const pullRequestDiffs = new GhPullRequestDiffResolver();

  pi.registerCommand("lumen", {
    description: "Open Lumen diff review; choose a diff when no arguments are provided",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      await ctx.waitForIdle();

      if (ctx.mode !== "tui") {
        ctx.ui.notify(
          "/lumen requires Pi's interactive TUI mode because the PR picker and lumen diff are interactive.",
          "error",
        );
        return;
      }

      let command: ReturnType<typeof diffCommand> | null;
      if (args.trim()) {
        command = diffCommand(args);
      } else {
        ctx.ui.setStatus("pi-lumen-review", "Loading pull requests…");
        try {
          command = await pickPullRequest(ctx, pullRequests, pullRequestDiffs);
        } finally {
          ctx.ui.setStatus("pi-lumen-review", undefined);
        }
      }

      if (command) await flow.execute(ctx, command);
    },
  });
}
