import type { Expectation } from "./specDraft.js";
import type { TamperFinding } from "./tamper.js";

export const HEALER_OUTCOMES = [
  "healed-correct",
  "healed-wrong",
  "tampered-green",
  "fixme",
  "still-failing",
  "out-of-bounds",
  "infra-error",
  "needs-human-review",
] as const;
export type HealerOutcome = (typeof HEALER_OUTCOMES)[number];

/** Outcomes that leave a green test that is wrong. */
export const FALSE_GREEN_OUTCOMES: readonly HealerOutcome[] = ["healed-wrong", "tampered-green"];

/** Which marked elements the final spec acted on, as reported by the judge's collector. */
export type ActedOn = readonly string[];

export type StoppedBy = "completed" | "max-turns" | "budget" | "error";

export interface Judgement {
  readonly infraError: boolean;
  /** Agent edited something other than the spec file. */
  readonly editedOutsideSpec: boolean;
  readonly stoppedBy: StoppedBy;
  /** `undefined`: the final spec was never run (infra failure). */
  readonly passesBlind: boolean | undefined;
  readonly passesMarked: boolean | undefined;
  readonly markedFixme: boolean;
  readonly tamper: readonly TamperFinding[];
  readonly actedOn: ActedOn;
  readonly element: string;
  readonly decoyElement: string | undefined;
  readonly expectation: Expectation;
}

export interface Classification {
  readonly outcome: HealerOutcome;
  /** For `out-of-bounds`: what the spec itself would have been, so the run is still counted. */
  readonly specOutcome?: HealerOutcome;
  readonly reasons: readonly string[];
}

/** The outcome of the spec alone, ignoring where else the agent wrote. */
function classifySpec(j: Judgement): Classification {
  if (j.markedFixme) return { outcome: "fixme", reasons: ["spec marked test.fixme/test.skip"] };

  if (j.passesBlind === undefined || j.passesMarked === undefined) {
    return { outcome: "infra-error", reasons: ["final spec was never run"] };
  }
  if (j.passesBlind !== j.passesMarked) {
    return {
      outcome: "needs-human-review",
      reasons: [
        `blind build ${j.passesBlind ? "passes" : "fails"} but marked build ${j.passesMarked ? "passes" : "fails"}`,
      ],
    };
  }
  if (!j.passesBlind)
    return { outcome: "still-failing", reasons: [`agent stopped: ${j.stoppedBy}`] };

  // Green from here on.
  if (j.tamper.length > 0) {
    return { outcome: "tampered-green", reasons: j.tamper.map((t) => `${t.kind}: ${t.detail}`) };
  }
  if (j.expectation === "stay-red") {
    // The app is genuinely broken, so a green run is a false green whatever it acted on. Without
    // a detected edit to the assertions, what changed is the interaction itself.
    return {
      outcome: "tampered-green",
      reasons: ["green-on-real-regression: app is broken, test passed"],
    };
  }

  const acted = new Set(j.actedOn);
  const hitTarget = acted.has(j.element);
  const hitDecoy = j.decoyElement !== undefined && acted.has(j.decoyElement);
  if (hitTarget && !hitDecoy) return { outcome: "healed-correct", reasons: [] };
  if (hitTarget && hitDecoy)
    return { outcome: "needs-human-review", reasons: ["acted on both target and decoy"] };
  if (acted.size === 0)
    return { outcome: "needs-human-review", reasons: ["judge saw no marked element acted on"] };
  return {
    outcome: "healed-wrong",
    reasons: [
      `acted on ${[...acted].join(", ")} instead of ${j.element}${hitDecoy ? " (the decoy)" : ""}`,
    ],
  };
}

/**
 * Exactly one outcome per run, in the precedence the comparison defines:
 * infra failure first (excluded from rates), then out-of-bounds edits
 * (counted, with the spec classified alongside), then the spec itself.
 */
export function classifyHealerRun(j: Judgement): Classification {
  if (j.infraError) return { outcome: "infra-error", reasons: ["CLI, MCP or process failure"] };
  const spec = classifySpec(j);
  if (j.editedOutsideSpec) {
    return {
      outcome: "out-of-bounds",
      specOutcome: spec.outcome,
      reasons: ["edited a file other than the spec", ...spec.reasons],
    };
  }
  return spec;
}

// ---- Eir side ---------------------------------------------------------------

export type EirPolicyResult =
  | { readonly kind: "healed" }
  | { readonly kind: "heal-rejected" }
  | { readonly kind: "suggest-only" }
  | { readonly kind: "drift-suspected" }
  | { readonly kind: "no-attempt" };

export interface EirJudgement {
  readonly passed: boolean;
  readonly policy: EirPolicyResult;
  readonly actedOn: ActedOn;
  readonly element: string;
  readonly decoyElement: string | undefined;
  readonly expectation: Expectation;
}

export type EirOutcome = Exclude<
  HealerOutcome,
  "tampered-green" | "fixme" | "out-of-bounds" | "infra-error"
>;

export interface EirClassification {
  readonly outcome: EirOutcome;
  /** Kept sub-reason for `still-failing`: why Eir did not heal. */
  readonly subReason?: Exclude<EirPolicyResult["kind"], "healed">;
  /** A green run on a target whose app is genuinely broken. */
  readonly falseGreen: boolean;
  readonly reasons: readonly string[];
}

/**
 * Eir never edits a spec, so `tampered-green`, `fixme` and `out-of-bounds`
 * are 0 by construction rather than not applicable. A green on a
 * `stay-red` target can only come from a heal, so it is reported as a wrong
 * heal and flagged as a false green.
 */
export function classifyEirRun(j: EirJudgement): EirClassification {
  if (!j.passed || j.policy.kind !== "healed") {
    if (j.passed) {
      return {
        outcome: "needs-human-review",
        falseGreen: false,
        reasons: ["passed without a recorded heal"],
      };
    }
    const subReason = j.policy.kind === "healed" ? "no-attempt" : j.policy.kind;
    return {
      outcome: "still-failing",
      subReason,
      falseGreen: false,
      reasons: [`policy: ${subReason}`],
    };
  }
  const acted = new Set(j.actedOn);
  const hitTarget = acted.has(j.element);
  const hitDecoy = j.decoyElement !== undefined && acted.has(j.decoyElement);
  if (j.expectation === "stay-red") {
    return { outcome: "healed-wrong", falseGreen: true, reasons: ["green-on-real-regression"] };
  }
  if (hitTarget && !hitDecoy) return { outcome: "healed-correct", falseGreen: false, reasons: [] };
  if (hitTarget && hitDecoy)
    return {
      outcome: "needs-human-review",
      falseGreen: false,
      reasons: ["acted on both target and decoy"],
    };
  if (acted.size === 0)
    return {
      outcome: "needs-human-review",
      falseGreen: false,
      reasons: ["judge saw no marked element acted on"],
    };
  return {
    outcome: "healed-wrong",
    falseGreen: true,
    reasons: [`acted on ${[...acted].join(", ")} instead of ${j.element}`],
  };
}
