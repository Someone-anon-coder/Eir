import { appendFile, readFile } from "node:fs/promises";

/**
 * The benchmark's own ground-truth channel for `near-duplicate-sibling-
 * swap` only (Phase 5): when a live target's probe fails, its `locate`
 * counterpart reads the *distractor's* live bounding box — read-only,
 * never clicked — so `classifyUnhealedFailure` can independently judge
 * whether Eir's matcher picked the correct element or its near-duplicate
 * twin, without ever telling the matcher the answer. Written by
 * `probes/probe.spec.ts`, read back by `probeRunner.ts` after the run.
 * Gated behind `EIR_GROUND_TRUTH_FILE`, set only by the harness itself.
 */

export interface QuantizedBoundingBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface GroundTruthLine {
  readonly targetId: string;
  readonly distractorBBox: QuantizedBoundingBox | null;
}

function isQuantizedBoundingBox(x: unknown): x is QuantizedBoundingBox {
  if (typeof x !== "object" || x === null) return false;
  const candidate = x as Record<string, unknown>;
  return (
    typeof candidate["x"] === "number" &&
    typeof candidate["y"] === "number" &&
    typeof candidate["w"] === "number" &&
    typeof candidate["h"] === "number"
  );
}

function isGroundTruthLine(x: unknown): x is GroundTruthLine {
  if (typeof x !== "object" || x === null) return false;
  const candidate = x as Record<string, unknown>;
  return (
    typeof candidate["targetId"] === "string" &&
    (candidate["distractorBBox"] === null || isQuantizedBoundingBox(candidate["distractorBBox"]))
  );
}

export async function appendGroundTruthFile(
  targetId: string,
  distractorBBox: QuantizedBoundingBox | null,
): Promise<void> {
  const filePath = process.env["EIR_GROUND_TRUTH_FILE"];
  if (filePath === undefined || filePath.length === 0) return;
  const line: GroundTruthLine = { targetId, distractorBBox };
  await appendFile(filePath, `${JSON.stringify(line)}\n`, "utf8");
}

export async function readGroundTruthFile(
  filePath: string,
): Promise<ReadonlyMap<string, QuantizedBoundingBox | null>> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    return new Map();
  }

  const result = new Map<string, QuantizedBoundingBox | null>();
  for (const line of raw.split("\n")) {
    if (line.trim().length === 0) continue;
    const parsed: unknown = JSON.parse(line);
    if (isGroundTruthLine(parsed)) {
      result.set(parsed.targetId, parsed.distractorBBox);
    }
  }
  return result;
}
