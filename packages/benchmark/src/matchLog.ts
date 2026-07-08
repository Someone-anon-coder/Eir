import { readFile } from "node:fs/promises";

/**
 * Mirrors `playwright-eir`'s internal match-log JSONL shape (written by
 * `packages/eir/src/matching/matchLogFile.ts`). Duplicated rather than
 * imported — same reasoning as `targets.ts`'s `OverridePayload`: Eir's
 * `exports` map only publishes `test`/`expect`/etc, and reaching into
 * another package's `src/` for convenience is exactly what CLAUDE.md
 * §7.1 reserves for a package's own internal modules. Read via the same
 * `unknown`-at-the-boundary discipline as everything else that crosses a
 * process/file boundary in this codebase — a shape mismatch (a future Eir
 * version changing this JSON) degrades to "no match data," never a crash.
 */

export interface MatchLogAncestorHop {
  readonly tag: string;
  readonly id: string | null;
  readonly classes: readonly string[];
}

export interface MatchLogBBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface MatchLogFeatures {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly text: string | null;
  readonly label: string | null;
  readonly ancestors: readonly MatchLogAncestorHop[];
  readonly siblingIndex: number;
  readonly siblingCount: number;
  readonly bbox: MatchLogBBox;
}

export interface MatchLogSuggestion {
  readonly kind: string;
  readonly description: string;
}

export type MatchAttemptResult =
  | { readonly kind: "rejected"; readonly reason: string; readonly detail: string }
  | { readonly kind: "no-candidates"; readonly fingerprint: MatchLogFeatures }
  | {
      readonly kind: "matched";
      readonly fingerprint: MatchLogFeatures;
      readonly candidateCount: number;
      readonly winner: MatchLogFeatures;
      readonly breakdown: Readonly<Record<string, number>>;
      readonly confidence: number;
      readonly margin: number;
      readonly suggestion: MatchLogSuggestion | null;
    };

export interface MatchLogEntry {
  readonly method: string;
  readonly route: string;
  readonly selectorKey: string;
  readonly result: MatchAttemptResult;
}

interface MatchLogLine {
  readonly testTitle: string;
  readonly attempts: readonly MatchLogEntry[];
}

function isBBox(x: unknown): x is MatchLogBBox {
  if (typeof x !== "object" || x === null) return false;
  const c = x as Record<string, unknown>;
  return (
    typeof c["x"] === "number" &&
    typeof c["y"] === "number" &&
    typeof c["w"] === "number" &&
    typeof c["h"] === "number"
  );
}

function isFeatures(x: unknown): x is MatchLogFeatures {
  if (typeof x !== "object" || x === null) return false;
  const c = x as Record<string, unknown>;
  return (
    typeof c["tag"] === "string" &&
    typeof c["attrs"] === "object" &&
    c["attrs"] !== null &&
    (c["text"] === null || typeof c["text"] === "string") &&
    (c["label"] === null || typeof c["label"] === "string") &&
    Array.isArray(c["ancestors"]) &&
    typeof c["siblingIndex"] === "number" &&
    typeof c["siblingCount"] === "number" &&
    isBBox(c["bbox"])
  );
}

function isResult(x: unknown): x is MatchAttemptResult {
  if (typeof x !== "object" || x === null) return false;
  const c = x as Record<string, unknown>;
  if (c["kind"] === "rejected") {
    return typeof c["reason"] === "string" && typeof c["detail"] === "string";
  }
  if (c["kind"] === "no-candidates") {
    return isFeatures(c["fingerprint"]);
  }
  if (c["kind"] === "matched") {
    return (
      isFeatures(c["fingerprint"]) &&
      typeof c["candidateCount"] === "number" &&
      isFeatures(c["winner"]) &&
      typeof c["breakdown"] === "object" &&
      c["breakdown"] !== null &&
      typeof c["confidence"] === "number" &&
      typeof c["margin"] === "number"
    );
  }
  return false;
}

function isMatchLogEntry(x: unknown): x is MatchLogEntry {
  if (typeof x !== "object" || x === null) return false;
  const c = x as Record<string, unknown>;
  return (
    typeof c["method"] === "string" &&
    typeof c["route"] === "string" &&
    typeof c["selectorKey"] === "string" &&
    isResult(c["result"])
  );
}

function isMatchLogLine(x: unknown): x is MatchLogLine {
  if (typeof x !== "object" || x === null) return false;
  const c = x as Record<string, unknown>;
  return typeof c["testTitle"] === "string" && Array.isArray(c["attempts"]) && c["attempts"].every(isMatchLogEntry);
}

/**
 * Keyed by test title — which `probes/probe.spec.ts` sets to the exact
 * `targetId` (`test(entry.targetId, ...)`), so no execution-order or
 * stdout-interleaving assumption is needed to correlate a heal attempt
 * back to its target.
 */
export async function readMatchLogFile(
  filePath: string,
): Promise<ReadonlyMap<string, readonly MatchLogEntry[]>> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    return new Map();
  }

  const result = new Map<string, readonly MatchLogEntry[]>();
  for (const line of raw.split("\n")) {
    if (line.trim().length === 0) continue;
    const parsed: unknown = JSON.parse(line);
    if (isMatchLogLine(parsed)) {
      result.set(parsed.testTitle, parsed.attempts);
    }
  }
  return result;
}
