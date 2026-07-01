import { type } from "arktype";

export const ReviewTargetSchema = type({ kind: "'workingTree'" })
  .or({ kind: "'detectPr'" })
  .or({ kind: "'pr'", idOrUrl: "string" })
  .or({ kind: "'range'", range: "string" });

export const ReviewRecordSchema = type({
  key: "string",
  label: "string",
  target: ReviewTargetSchema,
  cwd: "string",
  viewedAt: "number",
  "annotations?": "number",
});

export const StateSchema = type({ reviews: ReviewRecordSchema.array() });

export type CandidateSource = "history" | "mentioned" | "gh" | "default";
export type ReviewTarget = typeof ReviewTargetSchema.infer;
export type ReviewRecord = typeof ReviewRecordSchema.infer;
export type State = typeof StateSchema.infer;

export type LumenIntent =
  | { kind: "review"; target: ReviewTarget }
  | { kind: "explain"; args: string[] }
  | { kind: "draft"; args: string[] }
  | { kind: "operate"; args: string[] }
  | { kind: "configure"; args: string[] }
  | { kind: "list"; args: string[] };

export type ReviewCandidate = {
  target: ReviewTarget;
  source: CandidateSource;
  title: string;
  subtitle?: string;
};

export type LumenCommand = {
  program: "lumen";
  args: string[];
  display: string;
};

export type ReviewRun = {
  intent: Extract<LumenIntent, { kind: "review" }>;
  command: LumenCommand;
  key: string;
  label: string;
};

export type LumenRun =
  | { kind: "review"; review: ReviewRun }
  | { kind: "passthrough"; intent: Exclude<LumenIntent, { kind: "review" }>; command: LumenCommand };

/** Stable identity for review history and picker deduplication. */
export function reviewTargetKey(target: ReviewTarget): string {
  switch (target.kind) {
    case "workingTree":
      return "working-tree";
    case "detectPr":
      return "detect-pr";
    case "pr":
      return `pr:${target.idOrUrl}`;
    case "range":
      return `range:${target.range}`;
  }
}

/** Human-readable label for review history and agent feedback prompts. */
export function reviewTargetLabel(target: ReviewTarget): string {
  switch (target.kind) {
    case "workingTree":
      return "Working tree diff";
    case "detectPr":
      return "Current branch PR";
    case "pr":
      return `PR ${target.idOrUrl}`;
    case "range":
      return target.range;
  }
}

/** Convert the domain review target into the exact `lumen diff ...` argv suffix. */
export function reviewTargetToLumenArgs(target: ReviewTarget): string[] {
  switch (target.kind) {
    case "workingTree":
      return ["diff"];
    case "detectPr":
      return ["diff", "--detect-pr"];
    case "pr":
      return ["diff", "--pr", target.idOrUrl];
    case "range":
      return ["diff", target.range];
  }
}

/** Convert a typed intent to the process command executed at the shell boundary. */
export function commandForIntent(intent: LumenIntent): LumenCommand {
  const args = intent.kind === "review" ? reviewTargetToLumenArgs(intent.target) : [intent.kind, ...intent.args];
  return { program: "lumen", args, display: `lumen ${args.join(" ")}`.trim() };
}

/** Enrich an intent with review metadata when the run participates in the annotation flow. */
export function runForIntent(intent: LumenIntent): LumenRun {
  const command = commandForIntent(intent);
  if (intent.kind !== "review") return { kind: "passthrough", intent, command };
  return {
    kind: "review",
    review: { intent, command, key: reviewTargetKey(intent.target), label: reviewTargetLabel(intent.target) },
  };
}
