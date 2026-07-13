import { type } from "arktype";
import { defaultRunProcess, type ProcessRunner } from "./process.ts";

export type PullRequest = {
  number: number;
  title: string;
  author: string;
  updatedAt: string;
  isDraft: boolean;
  url: string;
};

export interface PullRequestProvider {
  listRecent(cwd: string): Promise<PullRequest[]>;
}

const ghPullRequestSchema = type({
  number: "number",
  title: "string",
  author: { login: "string" },
  updatedAt: "string",
  isDraft: "boolean",
  url: "string",
});

type GhPullRequest = typeof ghPullRequestSchema.infer;

const DEFAULT_LIMIT = 20;

/** Lists recent open pull requests through the GitHub CLI. */
export class GhPullRequestProvider implements PullRequestProvider {
  constructor(
    private readonly runProcess: ProcessRunner = defaultRunProcess,
    private readonly limit = DEFAULT_LIMIT,
  ) {}

  async listRecent(cwd: string): Promise<PullRequest[]> {
    const result = await this.runProcess(
      "gh",
      [
        "pr",
        "list",
        "--state",
        "open",
        "--limit",
        String(this.limit),
        "--json",
        "number,title,author,updatedAt,isDraft,url",
      ],
      cwd,
    );

    if (result.error) throw new Error(this.processError(result.error));
    if (result.code !== 0)
      throw new Error(result.stderr.trim() || "GitHub CLI could not list pull requests.");

    let data: unknown;
    try {
      data = JSON.parse(result.stdout);
    } catch {
      throw new Error("GitHub CLI returned invalid pull request data.");
    }

    if (!Array.isArray(data))
      throw new Error("GitHub CLI returned an unexpected pull request response.");
    return data.map(parsePullRequest);
  }

  private processError(message: string): string {
    return message.includes("ENOENT") || message.includes("not found")
      ? "GitHub CLI (`gh`) is not installed or not on PATH."
      : message;
  }
}

function parsePullRequest(value: unknown): PullRequest {
  let pr: GhPullRequest;
  try {
    pr = ghPullRequestSchema.assert(value);
  } catch {
    throw new Error("GitHub CLI returned a pull request with missing or invalid fields.");
  }

  return {
    number: pr.number,
    title: pr.title,
    author: pr.author.login,
    updatedAt: pr.updatedAt,
    isDraft: pr.isDraft,
    url: pr.url,
  };
}
