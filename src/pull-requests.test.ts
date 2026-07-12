import { describe, expect, test } from "bun:test";
import { GhPullRequestProvider, type ProcessResult } from "./pull-requests.ts";

const pullRequestJson = JSON.stringify([
  {
    number: 42,
    title: "Improve review flow",
    author: { login: "aryaman" },
    updatedAt: "2026-07-12T10:00:00Z",
    isDraft: false,
    url: "https://github.com/ad-world/pi-lumen/pull/42",
  },
]);

function successfulProcess(
  stdout: string,
): (program: string, args: string[], cwd: string) => Promise<ProcessResult> {
  return async () => ({ code: 0, stdout, stderr: "" });
}

describe("GhPullRequestProvider", () => {
  test("lists and normalizes pull requests from gh JSON", async () => {
    const provider = new GhPullRequestProvider(successfulProcess(pullRequestJson));

    await expect(provider.listRecent("/repo")).resolves.toEqual([
      {
        number: 42,
        title: "Improve review flow",
        author: "aryaman",
        updatedAt: "2026-07-12T10:00:00Z",
        isDraft: false,
        url: "https://github.com/ad-world/pi-lumen/pull/42",
      },
    ]);
  });

  test("passes the repository directory and gh list arguments", async () => {
    let received: { program: string; args: string[]; cwd: string } | undefined;
    const provider = new GhPullRequestProvider(async (program, args, cwd) => {
      received = { program, args, cwd };
      return { code: 0, stdout: "[]", stderr: "" };
    });

    await provider.listRecent("/repo");

    expect(received).toEqual({
      program: "gh",
      args: [
        "pr",
        "list",
        "--state",
        "open",
        "--limit",
        "20",
        "--json",
        "number,title,author,updatedAt,isDraft,url",
      ],
      cwd: "/repo",
    });
  });

  test("reports gh process failures", async () => {
    const provider = new GhPullRequestProvider(async () => ({
      code: 1,
      stdout: "",
      stderr: "not logged in to any GitHub hosts",
    }));

    await expect(provider.listRecent("/repo")).rejects.toThrow("not logged in");
  });

  test("reports malformed gh responses", async () => {
    const provider = new GhPullRequestProvider(successfulProcess("not json"));

    await expect(provider.listRecent("/repo")).rejects.toThrow("invalid pull request data");
  });
});
