import parseArgsStringToArgv from "string-argv";
import type { LumenIntent, ReviewTarget } from "./domain.ts";

const PASSTHROUGH_COMMANDS = new Set(["explain", "draft", "operate", "configure", "list"]);

/** Parse `/lumen ...` text into the small set of supported Lumen intents. */
export function parseLumenIntent(input: string): LumenIntent {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "review", target: { kind: "workingTree" } };

  const [head, rest] = splitHead(trimmed);
  if (PASSTHROUGH_COMMANDS.has(head)) return passthroughIntent(head, rest);

  return { kind: "review", target: parseReviewTarget(trimmed) };
}

function passthroughIntent(kind: string, rest: string): Exclude<LumenIntent, { kind: "review" }> {
  const args = rest ? parseArgv(rest) : [];
  switch (kind) {
    case "explain":
      return { kind, args };
    case "draft":
      return { kind, args };
    case "operate":
      return { kind, args: rest ? [rest] : [] };
    case "configure":
      return { kind, args };
    case "list":
      return { kind, args };
    default:
      throw new Error(`Unsupported Lumen passthrough command: ${kind}`);
  }
}

function parseReviewTarget(input: string): ReviewTarget {
  const args = parseArgv(input);
  if (args.length === 0) return { kind: "workingTree" };

  if (args.length === 1) {
    const ident = args[0]!;
    if (ident === "--detect-pr" || ident === "detect-pr") return { kind: "detectPr" };
    if (isPrIdentifier(ident)) return { kind: "pr", idOrUrl: ident.replace(/^#/, "") };
    return { kind: "range", range: ident };
  }

  if ((args[0] === "--pr" || args[0] === "pr") && args[1]) return { kind: "pr", idOrUrl: args[1].replace(/^#/, "") };
  if (args[0] === "--detect-pr") return { kind: "detectPr" };

  return { kind: "range", range: args.join(" ") };
}

function isPrIdentifier(value: string): boolean {
  return /^#?\d+$/.test(value) || /^https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/pull\/\d+/.test(value);
}

function splitHead(input: string): [head: string, rest: string] {
  const match = input.match(/^(\S+)(?:\s+([\s\S]*))?$/);
  return [match?.[1] ?? "", match?.[2] ?? ""];
}

function parseArgv(input: string): string[] {
  return parseArgsStringToArgv(input);
}
