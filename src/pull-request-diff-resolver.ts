import { type } from "arktype";
import type { PullRequest } from "./pull-requests.ts";
import { defaultRunProcess, type ProcessRunner } from "./process.ts";

export type PullRequestDiffResolution =
  | { kind: "local"; reference: string }
  | {
      kind: "remote";
      reference: string;
      reason: "metadata-unavailable" | "fetch-failed" | "history-incomplete";
    };

export interface PullRequestDiffResolver {
  resolve(
    cwd: string,
    pullRequest: Pick<PullRequest, "number" | "url">,
  ): Promise<PullRequestDiffResolution>;
}

const metadataSchema = type({
  number: "number",
  url: "string",
  baseRefName: "string",
  baseRefOid: /^[0-9a-fA-F]{40,64}$/,
  headRefOid: /^[0-9a-fA-F]{40,64}$/,
  isCrossRepository: "boolean",
});

type PullRequestMetadata = typeof metadataSchema.infer;
const MAX_FETCH_ATTEMPTS = 2;

/** Resolves a selected GitHub PR to an exact, usable local commit range when possible. */
export class GhPullRequestDiffResolver implements PullRequestDiffResolver {
  constructor(private readonly runProcess: ProcessRunner = defaultRunProcess) {}

  async resolve(
    cwd: string,
    pullRequest: Pick<PullRequest, "number" | "url">,
  ): Promise<PullRequestDiffResolution> {
    let metadata = await this.readMetadata(cwd, pullRequest.url);
    if (!metadata || metadata.number !== pullRequest.number) {
      return this.remote(pullRequest.url, "metadata-unavailable");
    }

    if (await this.hasUsableGraph(cwd, metadata)) return this.local(metadata);

    for (let attempt = 0; attempt < MAX_FETCH_ATTEMPTS; attempt += 1) {
      if (!(await this.fetchRevision(cwd, metadata))) {
        return this.remote(pullRequest.url, "fetch-failed");
      }

      const refreshed = await this.readMetadata(cwd, pullRequest.url);
      if (!refreshed || refreshed.number !== pullRequest.number) {
        return this.remote(pullRequest.url, "metadata-unavailable");
      }
      metadata = refreshed;

      if (await this.hasUsableGraph(cwd, metadata)) return this.local(metadata);
    }

    return this.remote(pullRequest.url, "history-incomplete");
  }

  private async readMetadata(cwd: string, url: string): Promise<PullRequestMetadata | null> {
    const result = await this.runProcess(
      "gh",
      [
        "pr",
        "view",
        url,
        "--json",
        "number,url,baseRefName,baseRefOid,headRefOid,isCrossRepository",
      ],
      cwd,
    );
    if (result.error || result.code !== 0) return null;

    try {
      return metadataSchema.assert(JSON.parse(result.stdout));
    } catch {
      return null;
    }
  }

  private async hasUsableGraph(cwd: string, metadata: PullRequestMetadata): Promise<boolean> {
    for (const oid of [metadata.baseRefOid, metadata.headRefOid]) {
      const object = await this.runProcess("git", ["cat-file", "-e", `${oid}^{commit}`], cwd);
      if (object.error || object.code !== 0) return false;
    }

    const mergeBase = await this.runProcess(
      "git",
      ["merge-base", metadata.baseRefOid, metadata.headRefOid],
      cwd,
    );
    return !mergeBase.error && mergeBase.code === 0;
  }

  private async fetchRevision(cwd: string, metadata: PullRequestMetadata): Promise<boolean> {
    const repositoryUrl = this.repositoryGitUrl(metadata.url, metadata.number);
    if (!repositoryUrl || !(await this.isValidBranch(cwd, metadata.baseRefName))) return false;

    const namespace = `refs/pi-lumen/pr/${metadata.number}`;
    const result = await this.runProcess(
      "git",
      [
        "fetch",
        "--quiet",
        "--no-tags",
        "--no-recurse-submodules",
        "--no-write-fetch-head",
        repositoryUrl,
        `+refs/heads/${metadata.baseRefName}:${namespace}/base`,
        `+refs/pull/${metadata.number}/head:${namespace}/head`,
      ],
      cwd,
    );
    return !result.error && result.code === 0;
  }

  private async isValidBranch(cwd: string, branch: string): Promise<boolean> {
    const result = await this.runProcess("git", ["check-ref-format", "--branch", branch], cwd);
    return !result.error && result.code === 0;
  }

  private repositoryGitUrl(prUrl: string, number: number): string | null {
    try {
      const url = new URL(prUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      const suffix = `/pull/${number}`;
      if (!url.pathname.endsWith(suffix)) return null;
      const repositoryPath = url.pathname.slice(0, -suffix.length);
      if (repositoryPath.split("/").filter(Boolean).length !== 2) return null;
      return `${url.origin}${repositoryPath}.git`;
    } catch {
      return null;
    }
  }

  private local(metadata: PullRequestMetadata): PullRequestDiffResolution {
    return { kind: "local", reference: `${metadata.baseRefOid}...${metadata.headRefOid}` };
  }

  private remote(
    reference: string,
    reason: Extract<PullRequestDiffResolution, { kind: "remote" }>["reason"],
  ): PullRequestDiffResolution {
    return { kind: "remote", reference, reason };
  }
}
