import { describe, expect, test } from "bun:test";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { pickPullRequest } from "./pull-request-picker.ts";
import type { PullRequest } from "./pull-requests.ts";

const pullRequests: PullRequest[] = [
  {
    number: 7,
    title: "Add picker",
    author: "contributor",
    updatedAt: "2026-07-12T10:00:00Z",
    isDraft: false,
    url: "https://github.com/example/repo/pull/7",
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
    );

    expect(result?.args).toEqual(["diff", "--pr", "7"]);
    expect(notifications).toEqual([]);
  });

  test("does not launch a command when the picker is cancelled", async () => {
    const notifications: string[] = [];
    const result = await pickPullRequest(context(undefined, notifications), {
      listRecent: async () => pullRequests,
    });

    expect(result).toBeNull();
    expect(notifications).toEqual([]);
  });

  test("notifies when there are no open pull requests", async () => {
    const notifications: string[] = [];
    const result = await pickPullRequest(context(undefined, notifications), {
      listRecent: async () => [],
    });

    expect(result).toBeNull();
    expect(notifications).toEqual(["No open pull requests found for this repository."]);
  });
});
