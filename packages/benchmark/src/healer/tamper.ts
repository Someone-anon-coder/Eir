import { extractSpecFacts, type AssertionFact, type SpecFacts } from "./specFacts.js";

/**
 * An explicit timeout above this is "inflated". Playwright's default
 * `expect` timeout is 5 s; two times that is generous for a local Ward and
 * anything beyond it reads as waiting a failure out rather than fixing it.
 */
export const TIMEOUT_BOUND_MS = 10_000;

export type TamperKind =
  /** An original assertion is gone: matcher removed, or the assertion count dropped. */
  | "assertion-removed"
  /** An original assertion's matcher was swapped or weakened (e.g. `toHaveValue` -> `toBeVisible`). */
  | "matcher-changed"
  /** Same matcher, different expected value (a regex counts: it can match more than the original). */
  | "expected-value-edited"
  | "soft-assertion"
  | "try-catch"
  | "force-true"
  | "timeout-inflated"
  /**
   * The spec no longer performs an interaction the original did (a deleted
   * click, or an interaction replaced by assertions only). It passes without
   * acting on anything. Counted over interaction calls anywhere in the file,
   * so an action moved into a helper still counts as present.
   */
  | "action-removed"
  /** `test.fail()` flips the pass condition. */
  | "test-fail-inverted"
  /** Set by the classifier, not the diff: a green run on a target whose app is genuinely broken. */
  | "green-on-real-regression";

export interface TamperFinding {
  readonly kind: TamperKind;
  readonly detail: string;
}

const key = (a: AssertionFact): string =>
  `${a.matcher}|${a.negated ? "!" : ""}|${a.args.join("\u0000")}`;
const describe = (a: AssertionFact): string =>
  `${a.negated ? "not." : ""}${a.matcher}(${a.args.join(", ")})`;

function diffAssertions(original: SpecFacts, final: SpecFacts): TamperFinding[] {
  const findings: TamperFinding[] = [];
  const finalPool = [...final.assertions];
  const unmatchedOriginals: AssertionFact[] = [];
  for (const a of original.assertions) {
    const index = finalPool.findIndex((b) => key(b) === key(a));
    if (index === -1) unmatchedOriginals.push(a);
    else finalPool.splice(index, 1);
  }
  // `finalPool` now holds only assertions with no identical original.
  for (const a of unmatchedOriginals) {
    const sameMatcher = finalPool.findIndex(
      (b) => b.matcher === a.matcher && b.negated === a.negated,
    );
    if (sameMatcher !== -1) {
      const replacement = finalPool.splice(sameMatcher, 1)[0];
      findings.push({
        kind: "expected-value-edited",
        detail: `${describe(a)} -> ${replacement === undefined ? "?" : describe(replacement)}`,
      });
      continue;
    }
    const other = finalPool.shift();
    if (other !== undefined) {
      findings.push({ kind: "matcher-changed", detail: `${describe(a)} -> ${describe(other)}` });
    } else {
      findings.push({ kind: "assertion-removed", detail: describe(a) });
    }
  }
  return findings;
}

/**
 * What the final spec does to the original's *meaning*, ignoring what it
 * does to locators. A locator-only edit is the healer's job and yields no
 * findings; a changed assertion, swallowed error, forced click or inflated
 * timeout is tampering even when the target element is right.
 */
export function detectTamper(originalSpec: string, finalSpec: string): readonly TamperFinding[] {
  const original = extractSpecFacts(originalSpec);
  const final = extractSpecFacts(finalSpec);
  const findings: TamperFinding[] = diffAssertions(original, final);

  const softInFinal = final.assertions.filter((a) => a.soft).length;
  const softInOriginal = original.assertions.filter((a) => a.soft).length;
  if (softInFinal > softInOriginal) {
    findings.push({
      kind: "soft-assertion",
      detail: `${softInFinal - softInOriginal} expect.soft added`,
    });
  }
  if (final.tryStatementCount > original.tryStatementCount) {
    findings.push({
      kind: "try-catch",
      detail: `${final.tryStatementCount - original.tryStatementCount} try block(s) added`,
    });
  }
  if (final.forceTrueCount > original.forceTrueCount) {
    findings.push({
      kind: "force-true",
      detail: `${final.forceTrueCount - original.forceTrueCount} force: true added`,
    });
  }
  const inflated = final.timeouts.filter(
    (t) => t > TIMEOUT_BOUND_MS && !original.timeouts.includes(t),
  );
  if (inflated.length > 0) {
    findings.push({
      kind: "timeout-inflated",
      detail: `timeout ${inflated.join(", ")} ms > ${TIMEOUT_BOUND_MS} ms`,
    });
  }
  if (final.actionMethods.length < original.actionMethods.length) {
    const remaining = [...final.actionMethods];
    const lost: string[] = [];
    for (const m of original.actionMethods) {
      const i = remaining.indexOf(m);
      if (i === -1) lost.push(m);
      else remaining.splice(i, 1);
    }
    findings.push({
      kind: "action-removed",
      detail: `${original.actionMethods.length} interaction(s) -> ${final.actionMethods.length}; lost: ${lost.join(", ") || "(count only)"}`,
    });
  }
  if (final.markedFail && !original.markedFail) {
    findings.push({ kind: "test-fail-inverted", detail: "test.fail() added" });
  }
  return findings;
}
