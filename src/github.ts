import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { type } from "arktype";
import type { ReviewCandidate } from "./domain.ts";

const GhPrSchema = type({ number: "number", title: "string", "headRefName?": "string", "baseRefName?": "string", "url?": "string" });
const GhPrListSchema = GhPrSchema.array();
type GhPr = typeof GhPrSchema.infer;

type GithubPrResult =
  | { ok: true; candidates: ReviewCandidate[] }
  | { ok: false; reason: "missing" | "failed" | "invalid-json"; message: string };

/** Load open GitHub PRs for the current repo via `gh pr list`, returning structured failure reasons for quiet degradation. */
export async function githubPrCandidates(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<GithubPrResult> {
  const result = await pi.exec(
    "gh",
    ["pr", "list", "--limit", "20", "--json", "number,title,headRefName,baseRefName,url"],
    { cwd: ctx.cwd, timeout: 8_000 },
  );

  if (result.code !== 0) {
    const stderr = result.stderr.trim();
    const unavailable = isExpectedUnavailableGithubContext(stderr);
    return {
      ok: false,
      reason: unavailable ? "missing" : "failed",
      message: stderr || `gh pr list exited with code ${result.code}`,
    };
  }

  try {
    const prs = GhPrListSchema.assert(JSON.parse(result.stdout));
    return { ok: true, candidates: prs.map(prToCandidate) };
  } catch (error) {
    return { ok: false, reason: "invalid-json", message: error instanceof Error ? error.message : String(error) };
  }
}

function isExpectedUnavailableGithubContext(stderr: string): boolean {
  return [
    "ENOENT",
    "not found",
    "command not found",
    "no git remotes found",
    "not a git repository",
    "none of the git remotes configured",
  ].some((needle) => stderr.toLowerCase().includes(needle.toLowerCase()));
}

function prToCandidate(pr: GhPr): ReviewCandidate {
  return {
    target: { kind: "pr", idOrUrl: String(pr.number) },
    source: "gh",
    title: `PR #${pr.number}: ${pr.title}`,
    subtitle: pr.headRefName && pr.baseRefName ? `${pr.baseRefName} ← ${pr.headRefName}` : pr.url,
  };
}
