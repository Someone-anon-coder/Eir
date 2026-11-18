import { classifyHealerRun, type Judgement, type StoppedBy } from "./classify.js";
import type { RunRecord } from "./runRecord.js";
import { materializeSpec, type SpecDraft } from "./specDraft.js";
import { extractSpecFacts } from "./specFacts.js";
import { detectTamper } from "./tamper.js";

export const REJUDGE_LABEL = "action-removed rule";

const STOPPED: ReadonlySet<string> = new Set(["completed", "max-turns", "budget", "error"]);

/**
 * Rebuilds one healer run's judgement from what was saved (its record and its
 * final spec) and classifies it again with the current rules. No healer is
 * re-run. Pass/fail is not stored, so it is recovered from the original
 * outcome: `still-failing` was red, everything else that reached the green
 * checks was green on both builds.
 */
export function rejudgeRecord(
  record: RunRecord,
  draft: SpecDraft,
  finalSpec: string | undefined,
): RunRecord {
  const detail = record.healer;
  if (detail === undefined || record.outcome === "infra-error") return record;
  const original = materializeSpec(draft);
  const wasRed = record.outcome === "still-failing";
  const stoppedBy: StoppedBy = STOPPED.has(detail.stoppedBy)
    ? (detail.stoppedBy as StoppedBy)
    : "completed";
  const tamper = finalSpec === undefined ? [] : detectTamper(original, finalSpec);
  const judgement: Judgement = {
    infraError: false,
    editedOutsideSpec: detail.editedOutside.length > 0,
    stoppedBy,
    passesBlind: finalSpec === undefined ? false : !wasRed,
    passesMarked: finalSpec === undefined ? false : !wasRed,
    markedFixme: finalSpec === undefined ? false : extractSpecFacts(finalSpec).markedFixme,
    tamper,
    actedOn: record.actedOn,
    element: draft.element,
    decoyElement: draft.decoyElement,
    expectation: draft.expectation,
  };
  const c = classifyHealerRun(judgement);
  if (c.outcome === record.outcome && c.specOutcome === record.specOutcome) {
    return { ...record, healer: { ...detail, tamper } };
  }
  return {
    ...record,
    outcome: c.outcome,
    specOutcome: c.specOutcome,
    reasons: c.reasons,
    previousOutcome: record.previousOutcome ?? record.outcome,
    rejudgedBy: REJUDGE_LABEL,
    healer: { ...detail, tamper },
  };
}

/** Records the human verdict on a run, as confirmation of what the harness classified (or as the verdict itself). */
export function adjudicate(
  record: RunRecord,
  verdict: RunRecord["outcome"],
  by: string,
  reason: string,
): RunRecord {
  return {
    ...record,
    adjudicated: true,
    adjudicatedBy: by,
    adjudicationVerdict: verdict,
    adjudicationReason: reason,
    outcome: verdict,
    reasons: record.reasons.includes(`adjudicated by ${by}: ${verdict} (${reason})`)
      ? record.reasons
      : [...record.reasons, `adjudicated by ${by}: ${verdict} (${reason})`],
  };
}
