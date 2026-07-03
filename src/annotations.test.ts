import { describe, expect, test } from "bun:test";
import { countAnnotations, extractAnnotations } from "./annotations.ts";

describe("extractAnnotations", () => {
  test("keeps a single valid annotation block with a location line", () => {
    const stdout = `src/index.ts line 12 (RIGHT)
This is the annotation text.`;

    expect(extractAnnotations(stdout)).toBe(stdout);
  });

  test("removes Lumen status lines", () => {
    const stdout = `✓ Fetched pull request metadata
⠋ Fetching changed files
src/review-flow.ts line 34 (RIGHT)
Keep this annotation.`;

    expect(extractAnnotations(stdout)).toBe(`src/review-flow.ts line 34 (RIGHT)
Keep this annotation.`);
  });

  test("strips common ANSI escape sequences while preserving annotation text", () => {
    const stdout = `\x1b[32msrc/index.ts line 12 (RIGHT)\x1b[0m
\x1b[1mPreserve this annotation.\x1b[0m`;

    expect(extractAnnotations(stdout)).toBe(`src/index.ts line 12 (RIGHT)
Preserve this annotation.`);
  });

  test("splits blocks on separators, discards blocks without locations, and rejoins valid blocks", () => {
    const stdout = `src/index.ts line 12 (RIGHT)
First annotation.
---
This block has no location and should be discarded.
---
src/runner.ts line 8 (LEFT)
Second annotation.`;

    expect(extractAnnotations(stdout)).toBe(`src/index.ts line 12 (RIGHT)
First annotation.
---
src/runner.ts line 8 (LEFT)
Second annotation.`);
  });
});

describe("countAnnotations", () => {
  test("returns the number of valid annotation blocks", () => {
    const annotations = `src/index.ts line 12 (RIGHT)
First annotation.
---
src/runner.ts line 8 (LEFT)
Second annotation.`;

    expect(countAnnotations(annotations)).toBe(2);
  });

  test("returns 0 for empty or whitespace input", () => {
    expect(countAnnotations("")).toBe(0);
    expect(countAnnotations("   \n\t  ")).toBe(0);
  });
});
