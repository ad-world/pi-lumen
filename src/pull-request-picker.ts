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
    const pullRequests = (await provider.listRecent(ctx.cwd)).sort((a, b) => {
      if (a.isCurrentBranch !== b.isCurrentBranch) return a.isCurrentBranch ? -1 : 1;
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });
    if (pullRequests.length === 0) {
      ctx.ui.notify("No open pull requests found for this repository.", "info");
      return null;
    }

    const options = pullRequests.map(formatPullRequest);
    const selected = await ctx.ui.select("Select a diff to review", options);
    if (!selected) return null;

    const pullRequest = pullRequests.find((pr) => formatPullRequest(pr) === selected);
    if (!pullRequest) {
      ctx.ui.notify("The selected pull request is no longer available.", "error");
      return null;
    }

    return pullRequestDiffCommand(ctx.cwd, pullRequest, resolver);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.ui.notify(`pi-lumen-review: ${message}`, "error");
    return null;
  }
}

export async function pullRequestDiffCommand(
  cwd: string,
  pullRequest: PullRequest,
  resolver: PullRequestDiffResolver,
): Promise<ReturnType<typeof diffCommand>> {
  const resolution = await resolver.resolve(cwd, pullRequest);
  return resolution.kind === "local"
    ? diffCommand(resolution.reference)
    : diffCommand(`--pr ${resolution.reference}`);
}

function formatPullRequest(pullRequest: PullRequest): string {
  const current = pullRequest.isCurrentBranch ? "★ " : "";
  const draft = pullRequest.isDraft ? " [draft]" : "";
  const updated = formatDate(pullRequest.updatedAt);
  return `${current}#${pullRequest.number} · ${pullRequest.title} · ${pullRequest.author} · updated ${updated}${draft}`;
}
