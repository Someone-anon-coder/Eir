import path from "node:path";

export type Tool = "healer" | "eir";

export interface RunKey {
  readonly tool: Tool;
  readonly targetId: string;
  /** 1-based. Eir runs are always run 1 (deterministic), plus an optional repeat. */
  readonly run: number;
}

export function runKeyString(key: RunKey): string {
  return `${key.tool}__${key.targetId}__run${key.run}`;
}

const safe = (s: string): string => s.replace(/[^A-Za-z0-9._-]/g, "_");

/** One JSON per (tool, target, run), so an interrupted job can resume by skipping what exists. */
export function runFilePath(outDir: string, key: RunKey): string {
  return path.join(outDir, key.tool, `${safe(key.targetId)}.run${key.run}.json`);
}

export interface PlanInput {
  readonly targetIds: readonly string[];
  readonly tools: readonly Tool[];
  readonly healerRuns: number;
  readonly eirRuns: number;
  readonly exists: (key: RunKey) => boolean;
}

export interface Plan {
  readonly pending: readonly RunKey[];
  readonly skipped: readonly RunKey[];
}

export function planRuns(input: PlanInput): Plan {
  const pending: RunKey[] = [];
  const skipped: RunKey[] = [];
  for (const targetId of input.targetIds) {
    for (const tool of input.tools) {
      const count = tool === "healer" ? input.healerRuns : input.eirRuns;
      for (let run = 1; run <= count; run++) {
        const key: RunKey = { tool, targetId, run };
        (input.exists(key) ? skipped : pending).push(key);
      }
    }
  }
  return { pending, skipped };
}
