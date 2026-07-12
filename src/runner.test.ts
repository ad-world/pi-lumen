import { describe, expect, test } from "bun:test";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { diffCommand } from "./command.ts";
import { LumenRunner } from "./runner.ts";

describe("LumenRunner", () => {
  test("rejects non-TUI modes before starting Lumen", async () => {
    const context = { mode: "json", cwd: "/repo" } as unknown as ExtensionCommandContext;

    await expect(new LumenRunner().run(context, diffCommand(""))).resolves.toEqual({
      code: null,
      stdout: "",
      error: "/lumen requires Pi's interactive TUI mode because lumen diff is interactive.",
    });
  });
});
