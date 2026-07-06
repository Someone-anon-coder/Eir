/**
 * The Fingerprint shape, per docs/fingerprint-schema.md (Aayush-signed-off,
 * Phase 3). This is the stable identity record Phase 5's matcher will read;
 * nothing in this phase reads it back for matching — capture and store only.
 */

export const FINGERPRINT_SCHEMA_VERSION = 1;

export interface AncestorHop {
  readonly tag: string;
  readonly id: string | null;
  readonly classes: readonly string[];
}

export interface QuantizedBoundingBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Fingerprint {
  readonly v: typeof FINGERPRINT_SCHEMA_VERSION;
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly text: string | null;
  readonly label: string | null;
  readonly ancestors: readonly AncestorHop[];
  readonly siblingIndex: number;
  readonly siblingCount: number;
  readonly bbox: QuantizedBoundingBox;
}

/**
 * Store files round-trip through disk as JSON, so reading them back is the
 * same `unknown`-at-the-boundary discipline as the browser capture — a
 * hand-edited or merge-conflicted file is treated as absent, never crashes
 * the run. Shallow by design: this proves the top-level shape, not every
 * nested ancestor hop.
 */
export function isFingerprint(x: unknown): x is Fingerprint {
  if (typeof x !== "object" || x === null) return false;
  const candidate = x as Record<string, unknown>;
  return (
    candidate["v"] === FINGERPRINT_SCHEMA_VERSION &&
    typeof candidate["tag"] === "string" &&
    typeof candidate["attrs"] === "object" &&
    candidate["attrs"] !== null &&
    (candidate["text"] === null || typeof candidate["text"] === "string") &&
    (candidate["label"] === null || typeof candidate["label"] === "string") &&
    Array.isArray(candidate["ancestors"]) &&
    typeof candidate["siblingIndex"] === "number" &&
    typeof candidate["siblingCount"] === "number" &&
    typeof candidate["bbox"] === "object" &&
    candidate["bbox"] !== null
  );
}
