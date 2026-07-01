import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { ReviewCandidate, ReviewTarget } from "./domain.ts";
import { reviewTargetKey } from "./domain.ts";
import { githubPrCandidates } from "./github.ts";
import { mentionedReviewCandidates } from "./session-mentions.ts";
import { ReviewStateStore } from "./state.ts";

const MAX_SELECT_ITEMS = 60;

/** Builds and presents the `/lumen` no-argument review target picker. */
export class ReviewPicker {
  constructor(
    private readonly pi: ExtensionAPI,
    private readonly state: ReviewStateStore,
  ) {}

  /** Show history, mentioned PRs/ranges, GitHub PRs, and defaults; return the selected review target. */
  async pick(ctx: ExtensionCommandContext, options: { prOnly?: boolean } = {}): Promise<ReviewTarget | undefined> {
    const candidates = await this.buildCandidates(ctx, options);
    const labels = candidates.map(formatCandidate);
    const selected = await ctx.ui.select("Open Lumen diff review", labels);
    if (!selected) return undefined;
    return candidates[labels.indexOf(selected)]?.target;
  }

  private async buildCandidates(ctx: ExtensionCommandContext, options: { prOnly?: boolean } = {}): Promise<ReviewCandidate[]> {
    const warnings = (message: string) => ctx.ui.notify(message, "warning");
    const gh = await githubPrCandidates(this.pi, ctx).catch((error: unknown) => ({
      ok: false as const,
      reason: "failed" as const,
      message: error instanceof Error ? error.message : String(error),
    }));

    if (!gh.ok && gh.reason !== "missing") {
      ctx.ui.notify(`pi-lumen: couldn't load GitHub PRs: ${gh.message}`, "warning");
    }

    const history = (await this.state.historyForCwd(ctx.cwd, warnings)).map((record) => ({
      target: record.target,
      source: "history" as const,
      title: record.label,
      subtitle: `viewed ${new Date(record.viewedAt).toLocaleString()}`,
    }));
    const mentioned = mentionedReviewCandidates(ctx);
    const prCandidates = [...history, ...mentioned, ...(gh.ok ? gh.candidates : [])].filter((candidate) => candidate.target.kind === "pr");

    if (options.prOnly) return dedupeCandidates(prCandidates).slice(0, MAX_SELECT_ITEMS);

    return dedupeCandidates([
      ...history,
      ...mentioned,
      ...(gh.ok ? gh.candidates : []),
      { target: { kind: "detectPr" }, source: "default", title: "Current branch PR", subtitle: "lumen diff --detect-pr" },
      { target: { kind: "workingTree" }, source: "default", title: "Working tree diff", subtitle: "lumen diff" },
    ]).slice(0, MAX_SELECT_ITEMS);
  }
}

function dedupeCandidates(candidates: ReviewCandidate[]): ReviewCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = reviewTargetKey(candidate.target);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatCandidate(candidate: ReviewCandidate): string {
  const prefix = candidate.source === "history" ? "history: " : candidate.source === "mentioned" ? "mentioned: " : candidate.source === "gh" ? "gh: " : "default: ";
  return `${prefix}${candidate.title}${candidate.subtitle ? ` — ${candidate.subtitle}` : ""}`;
}
