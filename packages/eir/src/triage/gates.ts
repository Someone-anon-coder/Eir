import type { Fingerprint } from "../fingerprint.js";
import type { FingerprintReader } from "../store/fingerprintReader.js";
import { classifyFailureSpecies, type FailureSpecies } from "./failureSpecies.js";

/**
 * Blueprint §7.4's four eligibility gates, in order — each a small pure
 * predicate over already-gathered facts (the I/O to gather them, e.g.
 * `page.url()`, lives in the async orchestrator that calls this, not here;
 * see matcher.ts). A `TimeoutError` is necessary but not sufficient to
 * attempt a heal — this is what decides "sufficient."
 */

export type TriageRejectionReason =
  | "no-fingerprint"
  | "page-not-sane"
  | "failure-species-not-heal-eligible"
  | "method-not-imperative";

export type TriageDecision =
  | { readonly kind: "eligible"; readonly fingerprint: Fingerprint }
  | { readonly kind: "rejected"; readonly reason: TriageRejectionReason; readonly detail: string };

export interface TriageInput {
  readonly route: string;
  readonly selectorKey: string;
  readonly reader: FingerprintReader;
  /** The route this selector's `EirLocator` was *created* on. */
  readonly routeAtCreation: string;
  /** The route the page is actually on right now, at failure time. */
  readonly currentRoute: string;
  readonly documentReady: boolean;
  readonly errorMessage: string;
  readonly isImperativeMethod: boolean;
}

/** Gate 1 — no baseline means this selector has never succeeded under Eir (record-mode onboarding, Blueprint §5.1); nothing to heal against. */
function gateFingerprintExists(input: TriageInput): Fingerprint | undefined {
  return input.reader.lookup(input.route, input.selectorKey);
}

/** Gate 2 — a dead/loading document or an unexpected route (e.g. a surprise redirect to /login) means this isn't locator drift; healing here would be noise. */
function gatePageSane(input: TriageInput): boolean {
  return input.documentReady && input.routeAtCreation === input.currentRoute;
}

/** Gate 3 — only zero-match and detached are heal-eligible; found-but-never-visible is usually a real application bug, not drift (see the Understanding Gate discussion in NOTES.md/session history: healing it would mask a regression). */
function gateFailureSpecies(input: TriageInput): FailureSpecies {
  return classifyFailureSpecies(input.errorMessage);
}

const HEAL_ELIGIBLE_SPECIES: ReadonlySet<FailureSpecies> = new Set(["zero-match", "detached"]);

/**
 * Gate 4 — interrogative methods (`isVisible`/`isEnabled`/`isChecked`/
 * `count`) never trigger healing. Already structurally guaranteed upstream
 * (they have no catch-and-react shell at all — see `eirLocator.ts`'s
 * interrogative section), so this gate is a standing invariant check
 * rather than a live rejection path in practice: nothing outside an
 * imperative method's catch block ever calls `runTriageGates`. Kept as a
 * real, tested gate anyway — defense in depth, and the DoD's "every gate
 * unit-tested and rejection-logged" bar applies equally to this one.
 */
function gateMethodImperative(input: TriageInput): boolean {
  return input.isImperativeMethod;
}

export function runTriageGates(input: TriageInput): TriageDecision {
  const fingerprint = gateFingerprintExists(input);
  if (fingerprint === undefined) {
    return {
      kind: "rejected",
      reason: "no-fingerprint",
      detail: `no baseline fingerprint for "${input.selectorKey}" on route "${input.route}"`,
    };
  }

  if (!gatePageSane(input)) {
    return {
      kind: "rejected",
      reason: "page-not-sane",
      detail: `document not ready or route changed (created on "${input.routeAtCreation}", now on "${input.currentRoute}")`,
    };
  }

  const species = gateFailureSpecies(input);
  if (!HEAL_ELIGIBLE_SPECIES.has(species)) {
    return {
      kind: "rejected",
      reason: "failure-species-not-heal-eligible",
      detail: `failure species "${species}" is not heal-eligible`,
    };
  }

  if (!gateMethodImperative(input)) {
    return {
      kind: "rejected",
      reason: "method-not-imperative",
      detail: "interrogative methods are never heal-eligible",
    };
  }

  return { kind: "eligible", fingerprint };
}
