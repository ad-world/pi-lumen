import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { type } from "arktype";
import type { ReviewRecord, ReviewTarget, State } from "./domain.ts";
import { StateSchema } from "./domain.ts";

const LegacyReviewRecordSchema = type({
  key: "string",
  label: "string",
  args: "string[]",
  cwd: "string",
  viewedAt: "number",
  "annotations?": "number",
});
const LegacyStateSchema = type({ reviews: LegacyReviewRecordSchema.array() });

const DEFAULT_STATE_PATH = join(homedir(), ".pi", "agent", "lumen", "state.json");
const MAX_HISTORY_PER_CWD = 30;

/** Persist and retrieve pi-lumen review history, including migration from old pre-domain-model state. */
export class ReviewStateStore {
  constructor(private readonly path = DEFAULT_STATE_PATH) {}

  /** Load review history. Corrupt JSON is backed up; legacy `args` records are migrated in memory. */
  async load(onWarning?: (message: string) => void): Promise<State> {
    if (!(await fileExists(this.path))) return { reviews: [] };

    const raw = await readFile(this.path, "utf8");
    try {
      return this.parse(JSON.parse(raw));
    } catch (error) {
      await this.replaceCorruptState(raw, onWarning, error);
      return { reviews: [] };
    }
  }

  /** Return this cwd's review history in most-recent-first order. */
  async historyForCwd(cwd: string, onWarning?: (message: string) => void): Promise<ReviewRecord[]> {
    return (await this.load(onWarning)).reviews.filter((record) => record.cwd === cwd).sort((a, b) => b.viewedAt - a.viewedAt);
  }

  /** Insert or update one review record and enforce bounded per-directory history. */
  async upsert(record: ReviewRecord, onWarning?: (message: string) => void): Promise<void> {
    const state = await this.load(onWarning);
    const withoutExisting = state.reviews.filter((r) => !(r.cwd === record.cwd && r.key === record.key));
    await this.save({ reviews: trimHistoryByCwd([record, ...withoutExisting]) });
  }

  /** Write the complete state file after validating the state against the canonical domain schema. */
  async save(state: State): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, `${JSON.stringify(StateSchema.assert(state), null, 2)}\n`, "utf8");
  }

  private parse(value: unknown): State {
    if (StateSchema.allows(value)) return value;
    if (LegacyStateSchema.allows(value)) return migrateLegacyState(value);
    return StateSchema.assert(value);
  }

  private async replaceCorruptState(raw: string, onWarning: ((message: string) => void) | undefined, error: unknown): Promise<void> {
    const backupPath = `${this.path}.corrupt.${Date.now()}`;
    try {
      await mkdir(dirname(this.path), { recursive: true });
      await rename(this.path, backupPath).catch(async () => writeFile(backupPath, raw, "utf8"));
      await this.save({ reviews: [] });
      onWarning?.(`pi-lumen: state file was corrupt and was moved to ${backupPath}`);
    } catch {
      onWarning?.(`pi-lumen: state file is corrupt: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function migrateLegacyState(state: typeof LegacyStateSchema.infer): State {
  return { reviews: state.reviews.map((record) => ({ ...record, target: legacyArgsToTarget(record.args) })) };
}

function legacyArgsToTarget(args: string[]): ReviewTarget {
  if (args.length === 0) return { kind: "workingTree" };
  if (args[0] === "--detect-pr") return { kind: "detectPr" };
  if (args[0] === "--pr" && args[1]) return { kind: "pr", idOrUrl: args[1] };
  return { kind: "range", range: args.join(" ") };
}

function trimHistoryByCwd(records: ReviewRecord[]): ReviewRecord[] {
  const keptByCwd = new Map<string, number>();
  return records.filter((record) => {
    const kept = keptByCwd.get(record.cwd) ?? 0;
    if (kept >= MAX_HISTORY_PER_CWD) return false;
    keptByCwd.set(record.cwd, kept + 1);
    return true;
  });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
