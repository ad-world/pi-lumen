import { type } from "arktype";
import { defaultRunProcess, type ProcessRunner } from "./process.ts";

export type PullRequest = {
  number: number;
  title: string;
  author: string;
  updatedAt: string;
  isDraft: boolean;
  url: string;
  isCurrentBranch: boolean;
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
    const currentBranchPullRequest = await this.currentBranchPullRequest(cwd);
    const result = await this.runProcess(
      "gh",
      [
        "pr",
        "list",
        "--state",
        "open",
        "--author",
        "@me",
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

    const pullRequests = data.map(parsePullRequest);
    if (!currentBranchPullRequest) return pullRequests;

    return [
      currentBranchPullRequest,
      ...pullRequests.filter(
        (pullRequest) => pullRequest.number !== currentBranchPullRequest.number,
      ),
    ];
  }

  private async currentBranchPullRequest(cwd: string): Promise<PullRequest | null> {
    const branch = await this.runProcess("git", ["branch", "--show-current"], cwd);
    const branchName = branch.code === 0 && !branch.error ? branch.stdout.trim() : "";
    if (!branchName) return null;

    const result = await this.runProcess(
      "gh",
      [
        "pr",
        "list",
        "--state",
        "open",
        "--author",
        "@me",
        "--head",
        branchName,
        "--limit",
        "1",
        "--json",
        "number,title,author,updatedAt,isDraft,url",
      ],
      cwd,
    );
    if (result.error || result.code !== 0) return null;

    try {
      const data: unknown = JSON.parse(result.stdout);
      if (!Array.isArray(data) || data.length === 0) return null;
      return { ...parsePullRequest(data[0]), isCurrentBranch: true };
    } catch {
      return null;
    }
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
    isCurrentBranch: false,
  };
}
