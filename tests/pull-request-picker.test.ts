import { describe, expect, test } from "bun:test";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { pickPullRequest } from "../src/pull-request-picker.ts";
import type { PullRequest } from "../src/pull-requests.ts";

const pullRequests: PullRequest[] = [
  {
    number: 7,
    title: "Add picker",
    author: "contributor",
    updatedAt: "2026-07-12T10:00:00Z",
    isDraft: false,
    url: "https://github.com/example/repo/pull/7",
    isCurrentBranch: false,
  },
];

function context(selected: string | undefined, notifications: string[]): ExtensionCommandContext {
  return {
    cwd: "/repo",
    ui: {
      select: async () => selected,
      notify: (message: string) => notifications.push(message),
    },
  } as unknown as ExtensionCommandContext;
}

describe("pickPullRequest", () => {
  test("turns the selected pull request into a diff command", async () => {
    const notifications: string[] = [];
    const result = await pickPullRequest(
      context("#7 · Add picker · contributor · updated 2026-07-12", notifications),
      {
        listRecent: async () => pullRequests,
      },
      {
        resolve: async () => ({ kind: "local", reference: "base...head" }),
      },
    );

    expect(result?.args).toEqual(["diff", "base...head"]);
    expect(notifications).toEqual([]);
  });

  test("keeps the current branch pull request at the top without local branch diff fallback", async () => {
    const currentPullRequest: PullRequest = {
      ...pullRequests[0]!,
      number: 8,
      title: "Current pushed PR",
      url: "https://github.com/example/repo/pull/8",
      updatedAt: "2026-07-01T10:00:00Z",
      isCurrentBranch: true,
    };
    const result = await pickPullRequest(
      context("★ #8 · Current pushed PR · contributor · updated 2026-07-01", []),
      {
        listRecent: async () => [pullRequests[0]!, currentPullRequest],
      },
      { resolve: async () => ({ kind: "local", reference: "pushed-base...pushed-head" }) },
    );

    expect(result?.args).toEqual(["diff", "pushed-base...pushed-head"]);
  });

  test("falls back to Lumen PR mode when no local range can be proven", async () => {
    const result = await pickPullRequest(
      context("#7 · Add picker · contributor · updated 2026-07-12", []),
      { listRecent: async () => pullRequests },
      {
        resolve: async () => ({
          kind: "remote",
          reference: pullRequests[0]!.url,
          reason: "fetch-failed",
        }),
      },
    );

    expect(result?.args).toEqual(["diff", "--pr", "https://github.com/example/repo/pull/7"]);
  });

  test("does not launch a command when the picker is cancelled", async () => {
    const notifications: string[] = [];
    const result = await pickPullRequest(
      context(undefined, notifications),
      { listRecent: async () => pullRequests },
      { resolve: async () => ({ kind: "local", reference: "base...head" }) },
    );

    expect(result).toBeNull();
    expect(notifications).toEqual([]);
  });

  test("notifies when there are no open pull requests", async () => {
    const notifications: string[] = [];
    const result = await pickPullRequest(
      context(undefined, notifications),
      { listRecent: async () => [] },
      { resolve: async () => ({ kind: "local", reference: "base...head" }) },
    );

    expect(result).toBeNull();
    expect(notifications).toEqual(["No open pull requests found for this repository."]);
  });
});
