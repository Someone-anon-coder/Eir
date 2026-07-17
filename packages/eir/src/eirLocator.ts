import type { Locator, Page } from "@playwright/test";
import { captureFingerprint } from "./capture/captureFingerprint.js";
import { capturePulse } from "./capture/capturePulse.js";
import {
  logCaptured,
  logDriftSuspected,
  logHealError,
  logHealOutcome,
  logMatchResult,
  logOutcome,
} from "./debugLog.js";
import { isFormallyUncertain } from "./fallback/trigger.js";
import type { FallbackOutcome } from "./fallback/verdict.js";
import type { Fingerprint } from "./fingerprint.js";
import { forwardOverloaded } from "./forwardOverloaded.js";
import { INITIAL_WEIGHTS } from "./matching/aggregate.js";
import type { MatchingContext } from "./matching/context.js";
import { attemptMatch } from "./matching/matcher.js";
import { checkSelfSimilarity } from "./policy/driftCheck.js";
import type { PostConditionVerification } from "./policy/policyLog.js";
import type { PolicyAction } from "./policy/stateMachine.js";
import { decidePolicyAction } from "./policy/stateMachine.js";
import { DEFAULT_DRIFT_SELF_SIMILARITY_THRESHOLD } from "./policy/thresholds.js";
import { derivePostCondition, postConditionMatches, type NormalizedPulse } from "./postCondition.js";
import { normalizeRoute } from "./routeNormalize.js";
import {
  type ChainHop,
  type SelectorIdentity,
  extendChain,
  routeFromUrl,
} from "./selectorIdentity.js";
import { normalizeSelector } from "./selectorNormalize.js";
import type { FingerprintRecorder } from "./store/fingerprintStore.js";
import type { PostConditionRecorder } from "./store/postConditionStore.js";

/**
 * Playwright's `expect()` duck-types these members at runtime
 * (`expectTypes` checks `_apiName`; every assertion calls `_expect(...)`
 * directly) — none are part of the public `Locator` type, so there is
 * no compile-time contract here. Confirmed via throwaway spikes (success
 * path + failure-message parity for `_apiName`/`_expect`; a real
 * `expect(locator).toHaveScreenshot()` run for `_frame`/`_selector`,
 * B2/RISK-003, 1.0.0 closure) before relying on any of them. Tracked as
 * NOTES.md RISK-003: a future Playwright version could change any of
 * these without a type error warning us.
 *
 * `_frame`/`_selector` specifically: `toHaveScreenshot()`'s real
 * implementation reaches into `options.locator._frame._channel` and
 * `.locator._selector` directly (`Page#_expectScreenshot`, playwright-
 * core) — not through any method call this class could intercept and
 * unwrap the way `.and()`/`.or()`/etc. do (NOTE-009). Forwarding these two
 * fields is the only way to make `expect(eirLocator).toHaveScreenshot()`
 * work at all.
 */
interface LocatorPrivateInternals {
  readonly _apiName: unknown;
  readonly _frame: unknown;
  readonly _selector: unknown;
  _expect(...args: unknown[]): unknown;
}

function internalsOf(real: Locator): LocatorPrivateInternals {
  return real as unknown as LocatorPrivateInternals;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * NOTE-009/RISK-005: a handful of real Playwright `Locator` methods
 * (`.and()`, `.or()`, `.dragTo()`, `.locator(sel, { has })`, `.filter({
 * has })`, plus `Page#addLocatorHandler`/`removeLocatorHandler`) expect one
 * of their *arguments* to be a real `Locator` and reach into its private
 * `_frame`/`_selector` fields directly. An `EirLocator` is not a real
 * `Locator` — it wraps one — so every such boundary must unwrap it first,
 * or Playwright finds those private fields `undefined` and throws. This is
 * the single, centralized place that happens; every call site (in this
 * file and in `eirPage.ts`) uses it rather than reimplementing the check.
 * `#real` is a true private class field — only code lexically inside the
 * class body can read it off another instance, hence the static method
 * below rather than a plain module-level function.
 */
export function unwrapLocator(locator: Locator): Locator {
  return EirLocator.unwrap(locator);
}

interface HasOptions {
  readonly has?: Locator;
  readonly hasNot?: Locator;
}

/**
 * Shared by every method whose options object can carry `has`/`hasNot`
 * (`.filter()`, `.locator()`, `Page#locator()`). Preserves every other
 * field untouched; returns the original object unchanged (not a copy) when
 * neither field is present or neither is an `EirLocator`, so callers that
 * omit `options` entirely still call the real method with the same arity.
 */
export function unwrapHasOptions<T extends HasOptions | undefined>(options: T): T {
  if (options === undefined) return options;
  const has = options.has !== undefined ? unwrapLocator(options.has) : options.has;
  const hasNot = options.hasNot !== undefined ? unwrapLocator(options.hasNot) : options.hasNot;
  if (has === options.has && hasNot === options.hasNot) return options;
  return { ...options, has, hasNot };
}

/**
 * Gate 2's "page sane" half (Blueprint §7.4): a dead server, a browser
 * error page, or a document that never finished loading all mean healing
 * here would be noise, not drift. Best-effort and cheap — an unresponsive
 * page fails this check rather than hanging the triage attempt.
 */
async function isPageSane(page: Page): Promise<boolean> {
  try {
    const url = page.url();
    if (url.startsWith("chrome-error://") || url === "about:blank") return false;
    const readyState = await page.evaluate(() => document.readyState);
    return readyState === "complete" || readyState === "interactive";
  } catch {
    return false;
  }
}

/** What Phase 6's policy decided, plus everything a retry or a report needs — computed once per failure, acted on by `#runImperative`. */
interface HealDecision {
  readonly matchAttempt: Awaited<ReturnType<typeof attemptMatch>> | null;
  readonly action: PolicyAction;
  readonly candidateLocator: Locator | null;
  readonly screenshot: Buffer | null;
}

type RetryExecution<R> =
  | { readonly kind: "healed"; readonly result: R; readonly verification: PostConditionVerification }
  | { readonly kind: "heal-rejected-post-condition-mismatch" }
  | { readonly kind: "heal-attempted-retry-failed" };

export class EirLocator implements Locator {
  readonly #real: Locator;
  readonly #identity: SelectorIdentity;
  readonly #recorder: FingerprintRecorder;
  readonly #postConditionRecorder: PostConditionRecorder;
  readonly #matching: MatchingContext;

  constructor(
    real: Locator,
    chainPath: readonly ChainHop[],
    recorder: FingerprintRecorder,
    postConditionRecorder: PostConditionRecorder,
    matching: MatchingContext,
  ) {
    this.#real = real;
    this.#identity = {
      rawSelector: real.toString(),
      chainPath,
      routeAtCreation: routeFromUrl(real.page().url()),
    };
    this.#recorder = recorder;
    this.#postConditionRecorder = postConditionRecorder;
    this.#matching = matching;
  }

  /** Not part of Playwright's `Locator` type — Eir's own book-keeping, read starting Phase 3. */
  get identity(): SelectorIdentity {
    return this.#identity;
  }

  /**
   * NOTE-009/RISK-005's unwrap step. `#real` is a true private class field
   * (`#`, not `private`) — readable off another instance only from code
   * lexically inside this class body, which is why this is a static method
   * rather than a free function next to it. Anything that isn't an
   * `EirLocator` (a real `Locator`, or one from a different wrapper
   * entirely) passes through untouched.
   */
  static unwrap(locator: Locator): Locator {
    return locator instanceof EirLocator ? locator.#real : locator;
  }

  #routeAndKey(): { readonly route: string; readonly selectorKey: string } {
    return {
      route: normalizeRoute(this.#identity.routeAtCreation),
      selectorKey: normalizeSelector(this.#identity.chainPath).key,
    };
  }

  /**
   * `captureFingerprint` is started *concurrently with the action itself*
   * (see `#runImperative`), not strictly after it resolves — a
   * deliberate, documented reinterpretation of Blueprint §7.2's "after a
   * successful action" as "conditioned on success," not "temporally
   * after." A live experiment against the demo app showed why: an action
   * that navigates away (a login submit, a nav link) destroys its own
   * element before a *post*-success `evaluate()` could reach it, so every
   * navigational selector silently never got fingerprinted. Starting the
   * browser round-trip while the element is still guaranteed to exist —
   * and only ever *recording* the result here, after success is
   * confirmed — closes that gap.
   *
   * Phase 6 (NOTE-001/RISK-009, Mechanism B): before overwriting the
   * baseline, scores the fresh capture against whatever was already
   * stored, reusing Phase 5's own weighted scorer unmodified. A
   * suspiciously low score gets logged as `drift-suspected` — never
   * blocks the refresh (record mode must keep drifting with legitimate
   * app evolution), purely additive report information.
   *
   * Fire-and-forget (Blueprint P1) either way: never awaited by a caller.
   * Registered with `trackPending` so worker teardown can await it.
   */
  #recordCapture(method: string, capture: Promise<Fingerprint | null>): void {
    const pending = capture
      .then((fingerprint) => {
        if (fingerprint === null) return;
        const { route, selectorKey } = this.#routeAndKey();
        logCaptured(this.#identity.rawSelector, route);

        const stored = this.#matching.reader.lookup(route, selectorKey);
        if (stored !== undefined) {
          const { suspected, score } = checkSelfSimilarity(
            stored,
            fingerprint,
            INITIAL_WEIGHTS,
            DEFAULT_DRIFT_SELF_SIMILARITY_THRESHOLD,
          );
          if (suspected) {
            logDriftSuspected(selectorKey, score);
            this.#matching.policyLog.record({
              kind: "drift-suspected",
              method,
              route,
              selectorKey,
              score,
            });
          }
        }

        this.#recorder.record(route, selectorKey, fingerprint);
      })
      .catch(() => {
        // Observability must never affect the test — see the docstring above.
      });
    this.#recorder.trackPending(pending);
  }

  /**
   * NOTE-001 retrofit, capture half: the page-level "before" pulse is
   * kicked off concurrently with the action (see `#runImperative`), same
   * timing reasoning as fingerprint capture; the "after" pulse is taken
   * here, once success is confirmed. Fire-and-forget, never blocks the
   * test — this is *record mode's* capture, distinct from heal-and-
   * continue's retry verification (`#retryHealed`), which does await.
   */
  #recordPostCondition(pulseBefore: Promise<NormalizedPulse | null>): void {
    const pending = (async () => {
      const before = await pulseBefore;
      if (before === null) return;
      const after = await capturePulse(this.#real.page());
      if (after === null) return;
      const { route, selectorKey } = this.#routeAndKey();
      this.#postConditionRecorder.record(route, selectorKey, derivePostCondition(before, after));
    })().catch(() => {
      // Observability must never affect the test — see #recordCapture's docstring.
    });
    this.#postConditionRecorder.trackPending(pending);
  }

  /**
   * Blueprint §7.5's full funnel plus Phase 6's policy decision, run on
   * every heal-eligible imperative failure. Never throws — matching must
   * never affect the test's own outcome, the same invariant
   * `#recordCapture` documents above; any internal error degrades to a
   * silent "nothing found" decision, exactly as Phase 5 did before this
   * phase added policy on top.
   */
  async #attemptHeal(method: string, error: unknown): Promise<HealDecision> {
    const noOp: HealDecision = {
      matchAttempt: null,
      action: { kind: "fail-normally" },
      candidateLocator: null,
      screenshot: null,
    };

    try {
      const page = this.#real.page();
      const { route, selectorKey } = this.#routeAndKey();
      const currentRoute = normalizeRoute(routeFromUrl(page.url()));
      const documentReady = await isPageSane(page);

      const matchAttempt = await attemptMatch({
        route,
        selectorKey,
        reader: this.#matching.reader,
        routeAtCreation: route,
        currentRoute,
        documentReady,
        errorMessage: messageOf(error),
        isImperativeMethod: true,
        page,
      });

      logMatchResult(selectorKey, matchAttempt.kind);
      this.#matching.log.record({ method, route, selectorKey, result: matchAttempt });

      const action = decidePolicyAction(matchAttempt, this.#matching.mode);

      let candidateLocator: Locator | null = null;
      let screenshot: Buffer | null = null;
      if (matchAttempt.kind === "matched") {
        candidateLocator = page
          .locator(matchAttempt.winnerLocator.selector)
          .nth(matchAttempt.winnerLocator.domIndex);
        screenshot = await candidateLocator.screenshot().catch(() => null);
      }

      return {
        matchAttempt,
        action,
        candidateLocator: action.kind === "heal-and-continue" ? candidateLocator : null,
        screenshot,
      };
    } catch (healError) {
      logHealError(this.#identity.rawSelector, healError);
      return noOp;
    }
  }

  /**
   * Executes heal-and-continue's one retry, then verifies NOTE-001's
   * post-condition around it (never the record-mode capture path — this
   * one genuinely `await`s, because the test's own outcome depends on the
   * result). A stored post-condition of `"none"` (or a pulse Eir
   * couldn't observe) always passes — the documented partial-coverage
   * case; nothing to verify isn't the same as verification failing.
   *
   * NOTE-004 (Phase 9): which of the three reasons a heal "passed"
   * verification is worth distinguishing in the report, not just
   * collapsing to a bare `"healed"` — see `PostConditionVerification`'s
   * docstring. `stored === undefined` (no baseline ever recorded for this
   * selector) is a materially weaker trust signal than a real stored
   * `"none"` or an unobservable pulse this one time; both of the latter
   * are the same "nothing to check" case Phase 6 always treated alike.
   */
  async #retryHealed<R>(
    action: (locator: Locator) => Promise<R>,
    candidateLocator: Locator,
    route: string,
    selectorKey: string,
  ): Promise<RetryExecution<R>> {
    try {
      const page = this.#real.page();
      const before = await capturePulse(page);
      const result = await action(candidateLocator);
      const after = await capturePulse(page);

      const stored = this.#matching.postConditionReader.lookup(route, selectorKey);
      if (stored === undefined) {
        return { kind: "healed", result, verification: "skipped-no-baseline" };
      }
      if (before === null || after === null) {
        return { kind: "healed", result, verification: "skipped-none" };
      }

      const observed = derivePostCondition(before, after);
      if (!postConditionMatches(stored, observed)) {
        return { kind: "heal-rejected-post-condition-mismatch" };
      }

      return {
        kind: "healed",
        result,
        verification: stored.kind === "none" ? "skipped-none" : "verified",
      };
    } catch {
      return { kind: "heal-attempted-retry-failed" };
    }
  }

  /**
   * The shared shell every imperative method (Blueprint §7.1) delegates
   * to — capture, try/catch, and (new this phase) policy + retry-once
   * all live here exactly once, instead of copy-pasted across 11
   * methods. `action` performs the real Playwright call against whichever
   * `Locator` it's handed: `this.#real` on the first attempt, the healed
   * candidate on retry.
   */
  async #runImperative<R>(method: string, action: (locator: Locator) => Promise<R>): Promise<R> {
    const capture = captureFingerprint(this.#real);
    const pulseBefore = capturePulse(this.#real.page());

    try {
      const result = await action(this.#real);
      logOutcome(method, "OK");
      this.#recordCapture(method, capture);
      this.#recordPostCondition(pulseBefore);
      return result;
    } catch (error) {
      logOutcome(method, "FAILED", messageOf(error));
      const decision = await this.#attemptHeal(method, error);

      if (decision.matchAttempt === null) {
        throw error;
      }

      const { route, selectorKey } = this.#routeAndKey();

      if (decision.action.kind === "heal-and-continue" && decision.candidateLocator !== null) {
        const retryOutcome = await this.#retryHealed(
          action,
          decision.candidateLocator,
          route,
          selectorKey,
        );

        this.#matching.policyLog.record({
          kind: "heal-attempt",
          method,
          route,
          selectorKey,
          matchAttempt: decision.matchAttempt,
          action: decision.action,
          retryOutcome:
            retryOutcome.kind === "healed"
              ? { kind: "healed", verification: retryOutcome.verification }
              : { kind: retryOutcome.kind },
          screenshot: decision.screenshot,
          // Structurally never consulted on this branch (Blueprint P4): the
          // fallback runs only after a non-heal decision, below.
          fallback: null,
        });

        if (retryOutcome.kind === "healed") {
          logHealOutcome(selectorKey, "healed");
          this.#matching.annotate("eir-healed", `${method} healed via ${selectorKey}`);
          return retryOutcome.result;
        }

        logHealOutcome(selectorKey, retryOutcome.kind);
        this.#matching.annotate(
          retryOutcome.kind === "heal-rejected-post-condition-mismatch"
            ? "eir-heal-rejected"
            : "eir-heal-attempt-failed",
          `${method} heal attempt on ${selectorKey} did not verify — original failure stands`,
        );
        throw error;
      }

      // Phase 8: the LLM fallback, consulted only here — after
      // `decidePolicyAction` has already returned a non-heal action — and
      // only when the trigger predicate says the match is a formal
      // admission of uncertainty. Its verdict lands on the policy event
      // (suggestion strength); it cannot reach `#retryHealed`, whose branch
      // completed above. Awaited deliberately: this test is already
      // failing, and the verdict must exist before the event is recorded.
      let fallback: FallbackOutcome | null = null;
      if (this.#matching.fallback !== null && isFormallyUncertain(decision.matchAttempt)) {
        const actionKind =
          decision.action.kind === "fail-with-suggestion" ? "fail-with-suggestion" : "fail-normally";
        fallback = await this.#matching.fallback
          .run(decision.matchAttempt, actionKind)
          .catch(() => null);
      }

      this.#matching.policyLog.record({
        kind: "heal-attempt",
        method,
        route,
        selectorKey,
        matchAttempt: decision.matchAttempt,
        action: decision.action,
        retryOutcome: { kind: "not-attempted" },
        screenshot: decision.screenshot,
        fallback,
      });

      if (decision.action.kind === "fail-with-suggestion") {
        this.#matching.annotate(
          "eir-suggested",
          `${method} on ${selectorKey}: a suggestion is available`,
        );
      }

      throw error;
    }
  }

  // ---- capture points (Blueprint §7.1): wrap the returned Locator so chains stay tracked ----

  locator(...args: Parameters<Locator["locator"]>): Locator {
    const [selectorOrLocator, options] = args;
    // NOTE-009/RISK-005: `selectorOrLocator` accepts `string | Locator`, and
    // `options.has`/`hasNot` accept a `Locator` too — all three need
    // unwrapping before reaching the real call. Identity/chain tracking
    // below still uses the original `args`, unwrapped or not — selector-key
    // generation is an orthogonal concern this fix doesn't touch.
    const unwrappedSelector =
      typeof selectorOrLocator === "string" ? selectorOrLocator : unwrapLocator(selectorOrLocator);
    const unwrappedOptions = unwrapHasOptions(options);
    const real =
      unwrappedOptions === undefined
        ? this.#real.locator(unwrappedSelector)
        : this.#real.locator(unwrappedSelector, unwrappedOptions);
    const chainPath = extendChain(this.#identity.chainPath, "locator", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath, this.#recorder, this.#postConditionRecorder, this.#matching);
  }

  getByRole(...args: Parameters<Locator["getByRole"]>): Locator {
    const real = this.#real.getByRole(...args);
    const chainPath = extendChain(this.#identity.chainPath, "getByRole", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath, this.#recorder, this.#postConditionRecorder, this.#matching);
  }

  getByLabel(...args: Parameters<Locator["getByLabel"]>): Locator {
    const real = this.#real.getByLabel(...args);
    const chainPath = extendChain(this.#identity.chainPath, "getByLabel", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath, this.#recorder, this.#postConditionRecorder, this.#matching);
  }

  getByText(...args: Parameters<Locator["getByText"]>): Locator {
    const real = this.#real.getByText(...args);
    const chainPath = extendChain(this.#identity.chainPath, "getByText", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath, this.#recorder, this.#postConditionRecorder, this.#matching);
  }

  getByTestId(...args: Parameters<Locator["getByTestId"]>): Locator {
    const real = this.#real.getByTestId(...args);
    const chainPath = extendChain(this.#identity.chainPath, "getByTestId", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath, this.#recorder, this.#postConditionRecorder, this.#matching);
  }

  getByPlaceholder(...args: Parameters<Locator["getByPlaceholder"]>): Locator {
    const real = this.#real.getByPlaceholder(...args);
    const chainPath = extendChain(this.#identity.chainPath, "getByPlaceholder", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath, this.#recorder, this.#postConditionRecorder, this.#matching);
  }

  // ---- imperative outcomes (Blueprint §7.1): shared shell, policy-aware since Phase 6 ----

  click(...args: Parameters<Locator["click"]>): ReturnType<Locator["click"]> {
    return this.#runImperative("click", (l) => l.click(...args));
  }

  fill(...args: Parameters<Locator["fill"]>): ReturnType<Locator["fill"]> {
    return this.#runImperative("fill", (l) => l.fill(...args));
  }

  type(...args: Parameters<Locator["type"]>): ReturnType<Locator["type"]> {
    return this.#runImperative("type", (l) => l.type(...args));
  }

  press(...args: Parameters<Locator["press"]>): ReturnType<Locator["press"]> {
    return this.#runImperative("press", (l) => l.press(...args));
  }

  check(...args: Parameters<Locator["check"]>): ReturnType<Locator["check"]> {
    return this.#runImperative("check", (l) => l.check(...args));
  }

  uncheck(...args: Parameters<Locator["uncheck"]>): ReturnType<Locator["uncheck"]> {
    return this.#runImperative("uncheck", (l) => l.uncheck(...args));
  }

  selectOption(
    ...args: Parameters<Locator["selectOption"]>
  ): ReturnType<Locator["selectOption"]> {
    return this.#runImperative("selectOption", (l) => l.selectOption(...args));
  }

  hover(...args: Parameters<Locator["hover"]>): ReturnType<Locator["hover"]> {
    return this.#runImperative("hover", (l) => l.hover(...args));
  }

  waitFor(...args: Parameters<Locator["waitFor"]>): ReturnType<Locator["waitFor"]> {
    return this.#runImperative("waitFor", (l) => l.waitFor(...args));
  }

  innerText(...args: Parameters<Locator["innerText"]>): ReturnType<Locator["innerText"]> {
    return this.#runImperative("innerText", (l) => l.innerText(...args));
  }

  textContent(
    ...args: Parameters<Locator["textContent"]>
  ): ReturnType<Locator["textContent"]> {
    return this.#runImperative("textContent", (l) => l.textContent(...args));
  }

  // ---- interrogative outcomes (Blueprint §7.4/§6): plain pass-through, structurally never heal-eligible ----

  isVisible(...args: Parameters<Locator["isVisible"]>): ReturnType<Locator["isVisible"]> {
    return this.#real.isVisible(...args);
  }

  isEnabled(...args: Parameters<Locator["isEnabled"]>): ReturnType<Locator["isEnabled"]> {
    return this.#real.isEnabled(...args);
  }

  isChecked(...args: Parameters<Locator["isChecked"]>): ReturnType<Locator["isChecked"]> {
    return this.#real.isChecked(...args);
  }

  count(...args: Parameters<Locator["count"]>): ReturnType<Locator["count"]> {
    return this.#real.count(...args);
  }

  // ---- everything else on Locator: plain pass-through, untouched (see NOTES.md RISK-004) ----
  // ---- (RISK-005/NOTE-009's Locator-argument unwrap is fixed at each of the few methods ----
  // ---- below that actually take one — `.and()`, `.or()`, `.dragTo()`, `.filter()` — the ----
  // ---- rest genuinely never receive a `Locator` argument and need no such handling.     ----

  all(...args: Parameters<Locator["all"]>): ReturnType<Locator["all"]> {
    return this.#real.all(...args);
  }

  allInnerTexts(
    ...args: Parameters<Locator["allInnerTexts"]>
  ): ReturnType<Locator["allInnerTexts"]> {
    return this.#real.allInnerTexts(...args);
  }

  allTextContents(
    ...args: Parameters<Locator["allTextContents"]>
  ): ReturnType<Locator["allTextContents"]> {
    return this.#real.allTextContents(...args);
  }

  // NOTE-009/RISK-005: `.and()` reaches into its argument's private
  // `_frame`/`_selector` fields — an `EirLocator` must unwrap to the real
  // `Locator` it holds before reaching this call.
  and(...args: Parameters<Locator["and"]>): ReturnType<Locator["and"]> {
    const [other] = args;
    return this.#real.and(unwrapLocator(other));
  }

  ariaSnapshot(...args: Parameters<Locator["ariaSnapshot"]>): ReturnType<Locator["ariaSnapshot"]> {
    return this.#real.ariaSnapshot(...args);
  }

  blur(...args: Parameters<Locator["blur"]>): ReturnType<Locator["blur"]> {
    return this.#real.blur(...args);
  }

  boundingBox(...args: Parameters<Locator["boundingBox"]>): ReturnType<Locator["boundingBox"]> {
    return this.#real.boundingBox(...args);
  }

  clear(...args: Parameters<Locator["clear"]>): ReturnType<Locator["clear"]> {
    return this.#real.clear(...args);
  }

  contentFrame(...args: Parameters<Locator["contentFrame"]>): ReturnType<Locator["contentFrame"]> {
    return this.#real.contentFrame(...args);
  }

  dblclick(...args: Parameters<Locator["dblclick"]>): ReturnType<Locator["dblclick"]> {
    return this.#real.dblclick(...args);
  }

  describe(...args: Parameters<Locator["describe"]>): ReturnType<Locator["describe"]> {
    return this.#real.describe(...args);
  }

  description(...args: Parameters<Locator["description"]>): ReturnType<Locator["description"]> {
    return this.#real.description(...args);
  }

  dispatchEvent(
    ...args: Parameters<Locator["dispatchEvent"]>
  ): ReturnType<Locator["dispatchEvent"]> {
    return this.#real.dispatchEvent(...args);
  }

  // NOTE-009/RISK-005: `target` must be a real `Locator`; `dragTo`'s own
  // options never carry a `Locator` field (verified against Playwright's
  // own types), so only the argument itself needs unwrapping.
  dragTo(...args: Parameters<Locator["dragTo"]>): ReturnType<Locator["dragTo"]> {
    const [target, options] = args;
    const unwrappedTarget = unwrapLocator(target);
    return options === undefined
      ? this.#real.dragTo(unwrappedTarget)
      : this.#real.dragTo(unwrappedTarget, options);
  }

  drop(...args: Parameters<Locator["drop"]>): ReturnType<Locator["drop"]> {
    return this.#real.drop(...args);
  }

  elementHandle(
    ...args: Parameters<Locator["elementHandle"]>
  ): ReturnType<Locator["elementHandle"]> {
    return this.#real.elementHandle(...args);
  }

  elementHandles(
    ...args: Parameters<Locator["elementHandles"]>
  ): ReturnType<Locator["elementHandles"]> {
    return this.#real.elementHandles(...args);
  }

  // NOTE-009/RISK-005: `options.has`/`hasNot` can each carry a `Locator`.
  filter(...args: Parameters<Locator["filter"]>): ReturnType<Locator["filter"]> {
    const [options] = args;
    const unwrappedOptions = unwrapHasOptions(options);
    return unwrappedOptions === undefined
      ? this.#real.filter()
      : this.#real.filter(unwrappedOptions);
  }

  first(...args: Parameters<Locator["first"]>): ReturnType<Locator["first"]> {
    return this.#real.first(...args);
  }

  focus(...args: Parameters<Locator["focus"]>): ReturnType<Locator["focus"]> {
    return this.#real.focus(...args);
  }

  frameLocator(...args: Parameters<Locator["frameLocator"]>): ReturnType<Locator["frameLocator"]> {
    return this.#real.frameLocator(...args);
  }

  getAttribute(...args: Parameters<Locator["getAttribute"]>): ReturnType<Locator["getAttribute"]> {
    return this.#real.getAttribute(...args);
  }

  getByAltText(...args: Parameters<Locator["getByAltText"]>): ReturnType<Locator["getByAltText"]> {
    return this.#real.getByAltText(...args);
  }

  getByTitle(...args: Parameters<Locator["getByTitle"]>): ReturnType<Locator["getByTitle"]> {
    return this.#real.getByTitle(...args);
  }

  hideHighlight(
    ...args: Parameters<Locator["hideHighlight"]>
  ): ReturnType<Locator["hideHighlight"]> {
    return this.#real.hideHighlight(...args);
  }

  highlight(...args: Parameters<Locator["highlight"]>): ReturnType<Locator["highlight"]> {
    return this.#real.highlight(...args);
  }

  innerHTML(...args: Parameters<Locator["innerHTML"]>): ReturnType<Locator["innerHTML"]> {
    return this.#real.innerHTML(...args);
  }

  inputValue(...args: Parameters<Locator["inputValue"]>): ReturnType<Locator["inputValue"]> {
    return this.#real.inputValue(...args);
  }

  isDisabled(...args: Parameters<Locator["isDisabled"]>): ReturnType<Locator["isDisabled"]> {
    return this.#real.isDisabled(...args);
  }

  isEditable(...args: Parameters<Locator["isEditable"]>): ReturnType<Locator["isEditable"]> {
    return this.#real.isEditable(...args);
  }

  isHidden(...args: Parameters<Locator["isHidden"]>): ReturnType<Locator["isHidden"]> {
    return this.#real.isHidden(...args);
  }

  last(...args: Parameters<Locator["last"]>): ReturnType<Locator["last"]> {
    return this.#real.last(...args);
  }

  normalize(...args: Parameters<Locator["normalize"]>): ReturnType<Locator["normalize"]> {
    return this.#real.normalize(...args);
  }

  nth(...args: Parameters<Locator["nth"]>): ReturnType<Locator["nth"]> {
    return this.#real.nth(...args);
  }

  // NOTE-009/RISK-005: `.or()` reaches into its argument's private
  // `_frame`/`_selector` fields, same as `.and()` above.
  or(...args: Parameters<Locator["or"]>): ReturnType<Locator["or"]> {
    const [other] = args;
    return this.#real.or(unwrapLocator(other));
  }

  page(...args: Parameters<Locator["page"]>): ReturnType<Locator["page"]> {
    return this.#real.page(...args);
  }

  pressSequentially(
    ...args: Parameters<Locator["pressSequentially"]>
  ): ReturnType<Locator["pressSequentially"]> {
    return this.#real.pressSequentially(...args);
  }

  screenshot(...args: Parameters<Locator["screenshot"]>): ReturnType<Locator["screenshot"]> {
    return this.#real.screenshot(...args);
  }

  scrollIntoViewIfNeeded(
    ...args: Parameters<Locator["scrollIntoViewIfNeeded"]>
  ): ReturnType<Locator["scrollIntoViewIfNeeded"]> {
    return this.#real.scrollIntoViewIfNeeded(...args);
  }

  selectText(...args: Parameters<Locator["selectText"]>): ReturnType<Locator["selectText"]> {
    return this.#real.selectText(...args);
  }

  setChecked(...args: Parameters<Locator["setChecked"]>): ReturnType<Locator["setChecked"]> {
    return this.#real.setChecked(...args);
  }

  setInputFiles(
    ...args: Parameters<Locator["setInputFiles"]>
  ): ReturnType<Locator["setInputFiles"]> {
    return this.#real.setInputFiles(...args);
  }

  tap(...args: Parameters<Locator["tap"]>): ReturnType<Locator["tap"]> {
    return this.#real.tap(...args);
  }

  toString(...args: Parameters<Locator["toString"]>): ReturnType<Locator["toString"]> {
    return this.#real.toString(...args);
  }

  // ---- generic/overloaded members: Parameters<>/ReturnType<> only see the last ----
  // ---- overload, so these are typed as full properties instead (Aayush-approved) ----

  readonly evaluate: Locator["evaluate"] = forwardOverloaded((...args: unknown[]) =>
    (this.#real.evaluate as (...a: unknown[]) => unknown)(...args),
  );

  readonly evaluateAll: Locator["evaluateAll"] = forwardOverloaded((...args: unknown[]) =>
    (this.#real.evaluateAll as (...a: unknown[]) => unknown)(...args),
  );

  readonly evaluateHandle: Locator["evaluateHandle"] = forwardOverloaded((...args: unknown[]) =>
    (this.#real.evaluateHandle as (...a: unknown[]) => unknown)(...args),
  );

  // ---- private runtime hooks `expect()` needs; not part of the public Locator type ----

  get _apiName(): unknown {
    return internalsOf(this.#real)._apiName;
  }

  _expect(...args: unknown[]): unknown {
    return internalsOf(this.#real)._expect(...args);
  }

  // B2/RISK-003 (1.0.0 closure): makes expect(eirLocator).toHaveScreenshot()
  // work — see LocatorPrivateInternals' docstring above for why.

  get _frame(): unknown {
    return internalsOf(this.#real)._frame;
  }

  get _selector(): unknown {
    return internalsOf(this.#real)._selector;
  }
}
