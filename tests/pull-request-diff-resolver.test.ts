import { describe, expect, test } from "bun:test";
import { GhPullRequestDiffResolver } from "../src/pull-request-diff-resolver.ts";
import type { ProcessRunner } from "../src/process.ts";

const base = "a".repeat(40);
const head = "b".repeat(40);
const changedHead = "c".repeat(40);
const pullRequest = { number: 7, url: "https://github.com/example/repo/pull/7" };

function metadata(headRefOid = head): string {
  return JSON.stringify({
    number: 7,
    url: pullRequest.url,
    baseRefName: "main",
    baseRefOid: base,
    headRefOid,
    isCrossRepository: true,
  });
}

function ok(stdout = ""): Awaited<ReturnType<ProcessRunner>> {
  return { code: 0, stdout, stderr: "" };
}

function fail(stderr = "failed"): Awaited<ReturnType<ProcessRunner>> {
  return { code: 1, stdout: "", stderr };
}

describe("GhPullRequestDiffResolver", () => {
  test("uses exact current OIDs without fetching when the complete graph is local", async () => {
    const calls: Array<{ program: string; args: string[] }> = [];
    const resolver = new GhPullRequestDiffResolver(async (program, args) => {
      calls.push({ program, args });
      if (program === "gh") return ok(metadata());
      return ok();
    });

    await expect(resolver.resolve("/repo", pullRequest)).resolves.toEqual({
      kind: "local",
      reference: `${base}...${head}`,
    });
    expect(calls.some((call) => call.args[0] === "fetch")).toBe(false);
    expect(calls.at(-1)?.args).toEqual(["merge-base", base, head]);
  });

  test("fetches PR refs without shallow history and rechecks metadata", async () => {
    const calls: Array<{ program: string; args: string[]; cwd: string }> = [];
    let graphChecks = 0;
    const resolver = new GhPullRequestDiffResolver(async (program, args, cwd) => {
      calls.push({ program, args, cwd });
      if (program === "gh") return ok(metadata());
      if (args[0] === "check-ref-format" || args[0] === "fetch") return ok();
      if (args[0] === "cat-file") {
        graphChecks += 1;
        return graphChecks === 1 ? fail() : ok();
      }
      return ok();
    });

    await expect(resolver.resolve("/repo", pullRequest)).resolves.toEqual({
      kind: "local",
      reference: `${base}...${head}`,
    });

    const fetch = calls.find((call) => call.args[0] === "fetch");
    expect(fetch).toEqual({
      program: "git",
      cwd: "/repo",
      args: [
        "fetch",
        "--quiet",
        "--no-tags",
        "--no-recurse-submodules",
        "--no-write-fetch-head",
        "https://github.com/example/repo.git",
        "+refs/heads/main:refs/pi-lumen-review/pr/7/base",
        "+refs/pull/7/head:refs/pi-lumen-review/pr/7/head",
      ],
    });
    expect(fetch?.args).not.toContain("--depth=1");
    expect(calls.filter((call) => call.program === "gh")).toHaveLength(2);
  });

  test("refetches once when the PR is force-pushed during resolution", async () => {
    let metadataReads = 0;
    const fetchedHeads: string[] = [];
    const resolver = new GhPullRequestDiffResolver(async (program, args) => {
      if (program === "gh") {
        metadataReads += 1;
        return ok(metadata(metadataReads === 1 ? head : changedHead));
      }
      if (args[0] === "cat-file") return metadataReads >= 3 ? ok() : fail();
      if (args[0] === "check-ref-format") return ok();
      if (args[0] === "fetch") {
        fetchedHeads.push(args.at(-1)!);
        return ok();
      }
      return ok();
    });

    await expect(resolver.resolve("/repo", pullRequest)).resolves.toEqual({
      kind: "local",
      reference: `${base}...${changedHead}`,
    });
    expect(fetchedHeads).toHaveLength(2);
    expect(metadataReads).toBe(3);
  });

  test("falls back when GitHub metadata is unavailable or malformed", async () => {
    const unavailable = new GhPullRequestDiffResolver(async () => fail("not logged in"));
    await expect(unavailable.resolve("/repo", pullRequest)).resolves.toEqual({
      kind: "remote",
      reference: pullRequest.url,
      reason: "metadata-unavailable",
    });

    const malformed = new GhPullRequestDiffResolver(async () => ok("{}"));
    await expect(malformed.resolve("/repo", pullRequest)).resolves.toEqual({
      kind: "remote",
      reference: pullRequest.url,
      reason: "metadata-unavailable",
    });
  });

  test("falls back when the narrow fetch fails", async () => {
    const resolver = new GhPullRequestDiffResolver(async (program, args) => {
      if (program === "gh") return ok(metadata());
      if (args[0] === "cat-file") return fail();
      if (args[0] === "check-ref-format") return ok();
      if (args[0] === "fetch") return fail("network down");
      return ok();
    });

    await expect(resolver.resolve("/repo", pullRequest)).resolves.toEqual({
      kind: "remote",
      reference: pullRequest.url,
      reason: "fetch-failed",
    });
  });

  test("does not trust endpoint existence when merge-base is unavailable", async () => {
    const resolver = new GhPullRequestDiffResolver(async (program, args) => {
      if (program === "gh") return ok(metadata());
      if (args[0] === "cat-file" || args[0] === "check-ref-format" || args[0] === "fetch") {
        return ok();
      }
      if (args[0] === "merge-base") return fail("shallow history");
      return ok();
    });

    await expect(resolver.resolve("/repo", pullRequest)).resolves.toEqual({
      kind: "remote",
      reference: pullRequest.url,
      reason: "history-incomplete",
    });
  });

  test("rejects unsafe repository URLs before fetching", async () => {
    const unsafe = { number: 7, url: "file:///tmp/repo/pull/7" };
    const resolver = new GhPullRequestDiffResolver(async (program, args) => {
      if (program === "gh") {
        return ok(metadata().replace(pullRequest.url, unsafe.url));
      }
      if (args[0] === "cat-file") return fail();
      return ok();
    });

    await expect(resolver.resolve("/repo", unsafe)).resolves.toEqual({
      kind: "remote",
      reference: unsafe.url,
      reason: "fetch-failed",
    });
  });
});
