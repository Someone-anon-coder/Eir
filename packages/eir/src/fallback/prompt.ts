import type { AncestorHop } from "../fingerprint.js";
import { FEATURE_NAMES } from "../matching/types.js";
import type { FallbackCandidate, FallbackContext } from "./verdict.js";

/**
 * Pure prompt builder — deterministic function of the context, so the
 * exact text sent for any benchmark row is reproducible and the prompt
 * itself is unit-testable. The data here is *only* what the scorers see
 * (fingerprint + candidate features + the scorers' own breakdown):
 * Blueprint §7.8 forbids raw DOM, screenshots, or any page content the
 * capture pipeline doesn't already extract, and this module is where that
 * constraint is physically enforced — there is no parameter through which
 * more could arrive.
 *
 * Prompt iterations are capped at two (approach doc OUT list). This is
 * iteration 1.
 */

function renderAncestors(ancestors: readonly AncestorHop[]): string {
  if (ancestors.length === 0) return "(none captured)";
  return ancestors
    .map((hop) => {
      const id = hop.id === null ? "" : `#${hop.id}`;
      const classes = hop.classes.length > 0 ? `.${hop.classes.join(".")}` : "";
      return `${hop.tag}${id}${classes}`;
    })
    .join(" > ");
}

function renderElement(el: {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly text: string | null;
  readonly label: string | null;
  readonly ancestors: readonly AncestorHop[];
  readonly siblingIndex: number;
  readonly siblingCount: number;
  readonly bbox: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}): string {
  const attrs =
    Object.entries(el.attrs)
      .map(([k, v]) => `${k}="${v}"`)
      .join(" ") || "(no captured attributes)";
  return [
    `  tag: <${el.tag}>`,
    `  attributes: ${attrs}`,
    `  visible text: ${el.text === null ? "(none)" : JSON.stringify(el.text)}`,
    `  associated label: ${el.label === null ? "(none)" : JSON.stringify(el.label)}`,
    `  ancestor chain: ${renderAncestors(el.ancestors)}`,
    `  sibling position: ${el.siblingIndex + 1} of ${el.siblingCount}`,
    `  quantized bounding box: x=${el.bbox.x} y=${el.bbox.y} w=${el.bbox.w} h=${el.bbox.h}`,
  ].join("\n");
}

function renderCandidate(cand: FallbackCandidate, index: number): string {
  const scores = FEATURE_NAMES.map((name) => `${name}=${cand.breakdown[name].toFixed(3)}`).join(
    ", ",
  );
  return [
    `Candidate ${index} (heuristic total ${cand.total.toFixed(4)}):`,
    renderElement(cand.features),
    `  heuristic feature scores: ${scores}`,
  ].join("\n");
}

export function buildFallbackPrompt(ctx: FallbackContext): string {
  return [
    "You are assisting a deterministic test-selector healing engine for Playwright.",
    "A selector that used to resolve to a known element now fails. The engine captured a fingerprint of the element while tests were passing, and has now scored the current page's plausible candidates against it — but the scores are too uncertain to trust (that is the only reason you are being consulted).",
    "",
    `Heuristic confidence was ${ctx.confidence.toFixed(4)} and the winner's margin over the runner-up was ${ctx.margin.toFixed(4)}. Candidates are listed best-scored first.`,
    "",
    "FINGERPRINT of the original element (captured while tests passed):",
    renderElement(ctx.fingerprint),
    "",
    "CURRENT CANDIDATES on the live page:",
    ...ctx.candidates.map((cand, index) => `${renderCandidate(cand, index)}\n`),
    "TASK: Decide which candidate, if any, is the same UI element the fingerprint describes — the element may have been renamed, restyled, rewrapped, or moved. Judge by the totality of identity evidence (attributes, text, label, structure, position), not by any single feature.",
    "",
    "Reply with JSON only, exactly this shape:",
    '{ "chosenCandidateIndex": <number index of your chosen candidate, or null if none of them is the element>, "reasoning": "<one or two sentences>" }',
  ].join("\n");
}
