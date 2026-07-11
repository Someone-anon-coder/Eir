import { readFile } from "node:fs/promises";

/**
 * Mirrors `playwright-eir`'s internal policy-log JSONL shape (written by
 * `packages/eir/src/policy/policyLogFile.ts`), same duplication reasoning
 * as `matchLog.ts` in this same directory — Eir's `exports` map doesn't
 * publish this, and reaching into another package's `src/` for
 * convenience is exactly what CLAUDE.md §7.1 reserves for a package's own
 * internals. This is the NOTE-001 retrofit's evidence channel: unlike
 * `matchLog.ts` (Phase 5's raw match attempt only), this carries what
 * policy actually *decided and did* — real retry outcomes, not inferred
 * ones.
 */

export type PolicyRetryOutcomeKind =
  | "not-attempted"
  | "healed"
  | "heal-rejected-post-condition-mismatch"
  | "heal-attempted-retry-failed";

export interface PolicyHealAttemptEntry {
  readonly kind: "heal-attempt";
  readonly method: string;
  readonly route: string;
  readonly selectorKey: string;
  readonly actionKind: "heal-and-continue" | "fail-with-suggestion" | "fail-normally";
  readonly retryOutcomeKind: PolicyRetryOutcomeKind;
  readonly confidence: number | null;
  readonly margin: number | null;
}

export interface PolicyDriftSuspectedEntry {
  readonly kind: "drift-suspected";
  readonly method: string;
  readonly route: string;
  readonly selectorKey: string;
  readonly score: number;
}

export type PolicyLogEntry = PolicyHealAttemptEntry | PolicyDriftSuspectedEntry;

interface PolicyLogLine {
  readonly testTitle: string;
  readonly events: readonly unknown[];
}

function isPolicyLogLine(x: unknown): x is PolicyLogLine {
  if (typeof x !== "object" || x === null) return false;
  const c = x as Record<string, unknown>;
  return typeof c["testTitle"] === "string" && Array.isArray(c["events"]);
}

/** Loose on purpose: only pulls the fields this evidence report needs, tolerant of the richer shape Eir actually writes (matchAttempt/screenshotBase64/etc, all ignored here). */
function toPolicyLogEntry(raw: unknown): PolicyLogEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const c = raw as Record<string, unknown>;

  if (c["kind"] === "drift-suspected") {
    if (
      typeof c["method"] === "string" &&
      typeof c["route"] === "string" &&
      typeof c["selectorKey"] === "string" &&
      typeof c["score"] === "number"
    ) {
      return {
        kind: "drift-suspected",
        method: c["method"],
        route: c["route"],
        selectorKey: c["selectorKey"],
        score: c["score"],
      };
    }
    return null;
  }

  if (c["kind"] === "heal-attempt") {
    const action = c["action"] as Record<string, unknown> | undefined;
    const retryOutcome = c["retryOutcome"] as Record<string, unknown> | undefined;
    const matchAttempt = c["matchAttempt"] as Record<string, unknown> | undefined;
    if (
      typeof c["method"] === "string" &&
      typeof c["route"] === "string" &&
      typeof c["selectorKey"] === "string" &&
      typeof action?.["kind"] === "string" &&
      typeof retryOutcome?.["kind"] === "string"
    ) {
      const confidence = typeof matchAttempt?.["confidence"] === "number" ? matchAttempt["confidence"] : null;
      const margin = typeof matchAttempt?.["margin"] === "number" ? matchAttempt["margin"] : null;
      return {
        kind: "heal-attempt",
        method: c["method"],
        route: c["route"],
        selectorKey: c["selectorKey"],
        actionKind: action["kind"] as PolicyHealAttemptEntry["actionKind"],
        retryOutcomeKind: retryOutcome["kind"] as PolicyRetryOutcomeKind,
        confidence,
        margin,
      };
    }
  }
  return null;
}

/** Keyed by test title, same convention as `readMatchLogFile`. */
export async function readPolicyLogFile(
  filePath: string,
): Promise<ReadonlyMap<string, readonly PolicyLogEntry[]>> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    return new Map();
  }

  const result = new Map<string, readonly PolicyLogEntry[]>();
  for (const line of raw.split("\n")) {
    if (line.trim().length === 0) continue;
    const parsed: unknown = JSON.parse(line);
    if (isPolicyLogLine(parsed)) {
      const events = parsed.events.map(toPolicyLogEntry).filter((e): e is PolicyLogEntry => e !== null);
      result.set(parsed.testTitle, events);
    }
  }
  return result;
}
