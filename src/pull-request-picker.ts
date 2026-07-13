import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { diffCommand } from "./command.ts";
import type { PullRequestDiffResolver } from "./pull-request-diff-resolver.ts";
import type { PullRequest, PullRequestProvider } from "./pull-requests.ts";
import { formatDate } from "./utils/date.ts";

/** Shows recent pull requests and turns the selected one into a Lumen command. */
export async function pickPullRequest(
  ctx: ExtensionCommandContext,
  provider: PullRequestProvider,
  resolver: PullRequestDiffResolver,
): Promise<ReturnType<typeof diffCommand> | null> {
  try {
    const pullRequests = await provider.listRecent(ctx.cwd);
    if (pullRequests.length === 0) {
      ctx.ui.notify("No open pull requests found for this repository.", "info");
      return null;
    }

    const selected = await ctx.ui.select(
      "Select a recent pull request",
      pullRequests.map(formatPullRequest),
    );
    if (!selected) return null;

    const pullRequest = pullRequests.find((pr) => formatPullRequest(pr) === selected);
    if (!pullRequest) {
      ctx.ui.notify("The selected pull request is no longer available.", "error");
      return null;
    }

    const resolution = await resolver.resolve(ctx.cwd, pullRequest);
    return resolution.kind === "local"
      ? diffCommand(resolution.reference)
      : diffCommand(`--pr ${resolution.reference}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.ui.notify(`pi-lumen: ${message}`, "error");
    return null;
  }
}

function formatPullRequest(pullRequest: PullRequest): string {
  const draft = pullRequest.isDraft ? " [draft]" : "";
  const updated = formatDate(pullRequest.updatedAt);
  return `#${pullRequest.number} · ${pullRequest.title} · ${pullRequest.author} · updated ${updated}${draft}`;
}
