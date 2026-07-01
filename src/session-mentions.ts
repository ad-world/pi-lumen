import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { ReviewCandidate } from "./domain.ts";

type TextPart = { type?: string; text?: unknown };
type BranchEntry = { type?: string; message?: { role?: string; content?: unknown }; content?: unknown; data?: unknown };

const MAX_SCANNED_ENTRIES = 80;

/** Extract PR URLs, PR number mentions, and git ranges from recent Pi session messages for picker suggestions. */
export function mentionedReviewCandidates(ctx: ExtensionCommandContext): ReviewCandidate[] {
  const text = recentConversationText(ctx);
  const candidates: ReviewCandidate[] = [];

  for (const match of text.matchAll(/https:\/\/github\.com\/[^\s)]+\/[^\s)]+\/pull\/(\d+)/gi)) {
    const url = match[0];
    candidates.push({
      target: { kind: "pr", idOrUrl: url },
      source: "mentioned",
      title: `PR #${match[1]}`,
      subtitle: url,
    });
  }

  for (const match of text.matchAll(/\b(?:PR|pull request)\s*#?(\d+)\b/gi)) {
    const number = match[1]!;
    candidates.push({ target: { kind: "pr", idOrUrl: number }, source: "mentioned", title: `PR #${number}` });
  }

  for (const match of text.matchAll(/(?:^|\s)([A-Za-z0-9_/@{}~^.-]+\.{2,3}[A-Za-z0-9_/@{}~^.-]+)(?=$|\s|[,;.)])/g)) {
    const range = match[1]!;
    candidates.push({ target: { kind: "range", range }, source: "mentioned", title: range });
  }

  return candidates;
}

function recentConversationText(ctx: ExtensionCommandContext): string {
  const entries = ctx.sessionManager.getBranch().slice(-MAX_SCANNED_ENTRIES) as BranchEntry[];
  return entries
    .filter((entry) => entry.type === "message" || entry.message)
    .map(entryText)
    .filter(Boolean)
    .join("\n");
}

function entryText(entry: BranchEntry): string {
  const content = entry.message?.content ?? entry.content ?? entry.data;
  return textFromContent(content);
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part: unknown) => {
      if (typeof part === "string") return part;
      if (isTextPart(part) && typeof part.text === "string") return part.text;
      return "";
    })
    .join("\n");
}

function isTextPart(value: unknown): value is TextPart {
  return value !== null && typeof value === "object" && "text" in value;
}
