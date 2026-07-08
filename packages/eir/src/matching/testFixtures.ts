import { FINGERPRINT_SCHEMA_VERSION, type Fingerprint } from "../fingerprint.js";
import type { CandidateFeatures } from "./types.js";

/** Shared scorer-test builders — sensible defaults, override only what a case cares about. */
export function makeFingerprint(overrides: Partial<Fingerprint> = {}): Fingerprint {
  return {
    v: FINGERPRINT_SCHEMA_VERSION,
    tag: "button",
    attrs: { "data-testid": "device-row-remove", type: "button" },
    text: "Remove",
    label: null,
    ancestors: [
      { tag: "td", id: null, classes: [] },
      { tag: "tr", id: null, classes: [] },
      { tag: "tbody", id: null, classes: [] },
    ],
    siblingIndex: 1,
    siblingCount: 2,
    bbox: { x: 100, y: 200, w: 64, h: 32 },
    ...overrides,
  };
}

export function makeCandidate(overrides: Partial<CandidateFeatures> = {}): CandidateFeatures {
  const fingerprint = makeFingerprint();
  const rest: CandidateFeatures = {
    tag: fingerprint.tag,
    attrs: fingerprint.attrs,
    text: fingerprint.text,
    label: fingerprint.label,
    ancestors: fingerprint.ancestors,
    siblingIndex: fingerprint.siblingIndex,
    siblingCount: fingerprint.siblingCount,
    bbox: fingerprint.bbox,
  };
  return { ...rest, ...overrides };
}
