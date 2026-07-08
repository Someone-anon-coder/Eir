import type { Locator, Page } from "@playwright/test";
import { captureFingerprint } from "./capture/captureFingerprint.js";
import { logCaptured, logFingerprinted, logOutcome } from "./debugLog.js";
import type { Fingerprint } from "./fingerprint.js";
import { forwardOverloaded } from "./forwardOverloaded.js";
import type { MatchingContext } from "./matching/context.js";
import { attemptMatch } from "./matching/matcher.js";
import { normalizeRoute } from "./routeNormalize.js";
import {
  type ChainHop,
  type SelectorIdentity,
  extendChain,
  routeFromUrl,
} from "./selectorIdentity.js";
import { normalizeSelector } from "./selectorNormalize.js";
import type { FingerprintRecorder } from "./store/fingerprintStore.js";

/**
 * Playwright's `expect()` duck-types these two members at runtime
 * (`expectTypes` checks `_apiName`; every assertion calls `_expect(...)`
 * directly) — neither is part of the public `Locator` type, so there is
 * no compile-time contract here. Confirmed via a throwaway spike (success
 * path + failure-message parity) before relying on it. Tracked as
 * NOTES.md RISK-003: a future Playwright version could change this
 * without a type error warning us.
 */
interface LocatorPrivateInternals {
  readonly _apiName: unknown;
  _expect(...args: unknown[]): unknown;
}

function internalsOf(real: Locator): LocatorPrivateInternals {
  return real as unknown as LocatorPrivateInternals;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

export class EirLocator implements Locator {
  readonly #real: Locator;
  readonly #identity: SelectorIdentity;
  readonly #recorder: FingerprintRecorder;
  readonly #matching: MatchingContext;

  constructor(
    real: Locator,
    chainPath: readonly ChainHop[],
    recorder: FingerprintRecorder,
    matching: MatchingContext,
  ) {
    this.#real = real;
    this.#identity = {
      rawSelector: real.toString(),
      chainPath,
      routeAtCreation: routeFromUrl(real.page().url()),
    };
    this.#recorder = recorder;
    this.#matching = matching;
  }

  /** Not part of Playwright's `Locator` type — Eir's own book-keeping, read starting Phase 3. */
  get identity(): SelectorIdentity {
    return this.#identity;
  }

  /**
   * `captureFingerprint` is started *concurrently with the action itself*
   * (see each imperative method below), not strictly after it resolves —
   * a deliberate, documented reinterpretation of Blueprint §7.2's "after a
   * successful action" as "conditioned on success," not "temporally
   * after." A live experiment against the demo app showed why: an action
   * that navigates away (a login submit, a nav link) destroys its own
   * element before a *post*-success `evaluate()` call can reach it, so
   * every navigational selector silently never got fingerprinted. Starting
   * the browser round-trip while the element is still guaranteed to exist
   * — and only ever *recording* the result here, after success is
   * confirmed — closes that gap. Confirmed via 3 repeated full-suite runs:
   * deterministic capture, no change to any action's own pass/fail
   * behavior or timing.
   *
   * Fire-and-forget (Blueprint P1) either way: never awaited by a caller,
   * so the outcome shells return the instant the real action resolves.
   * The trailing `.catch()` guards this method's own code
   * (normalizeRoute/normalizeSelector/recorder.record) — `captureFingerprint`
   * itself is built to never reject, but an unhandled rejection from
   * *this* callback would still crash the worker process.
   *
   * Registered with `trackPending` so worker teardown can await it —
   * "fire-and-forget" means the test never waits, not that nothing ever
   * does; something has to, or the last action's capture can be silently
   * dropped when the worker shuts down before the browser round-trip
   * finishes.
   */
  #recordCapture(capture: Promise<Fingerprint | null>): void {
    const pending = capture
      .then((fingerprint) => {
        if (fingerprint === null) return;
        const route = normalizeRoute(this.#identity.routeAtCreation);
        const { key } = normalizeSelector(this.#identity.chainPath);
        logFingerprinted(key, route);
        this.#recorder.record(route, key, fingerprint);
      })
      .catch(() => {
        // Observability must never affect the test — see the docstring above.
      });
    this.#recorder.trackPending(pending);
  }

  /**
   * Blueprint §7.5's full funnel, run on every heal-eligible imperative
   * failure. Phase 5 scope: the result is *recorded* via `MatchingContext`
   * — never retried, never changes what the caller sees (the original
   * error still rethrows unconditionally right after this resolves).
   * Awaited rather than fire-and-forget, unlike fingerprint capture:
   * there's no later "success" event to hang this off of, and Phase 6's
   * retry (not yet built) will need this same result synchronously
   * available before the catch block decides anything.
   *
   * Never throws — matching must never affect the test's own outcome, the
   * same invariant `#recordCapture` documents above.
   */
  async #attemptHeal(method: string, error: unknown): Promise<void> {
    try {
      const page = this.#real.page();
      const route = normalizeRoute(this.#identity.routeAtCreation);
      const { key: selectorKey } = normalizeSelector(this.#identity.chainPath);
      const currentRoute = normalizeRoute(routeFromUrl(page.url()));
      const documentReady = await isPageSane(page);

      const result = await attemptMatch({
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

      this.#matching.log.record({ method, route, selectorKey, result });
    } catch {
      // Matching must never affect the test's own outcome — see the docstring above.
    }
  }

  // ---- capture points (Blueprint §7.1): wrap the returned Locator so chains stay tracked ----

  locator(...args: Parameters<Locator["locator"]>): Locator {
    const real = this.#real.locator(...args);
    const chainPath = extendChain(this.#identity.chainPath, "locator", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath, this.#recorder, this.#matching);
  }

  getByRole(...args: Parameters<Locator["getByRole"]>): Locator {
    const real = this.#real.getByRole(...args);
    const chainPath = extendChain(this.#identity.chainPath, "getByRole", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath, this.#recorder, this.#matching);
  }

  getByLabel(...args: Parameters<Locator["getByLabel"]>): Locator {
    const real = this.#real.getByLabel(...args);
    const chainPath = extendChain(this.#identity.chainPath, "getByLabel", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath, this.#recorder, this.#matching);
  }

  getByText(...args: Parameters<Locator["getByText"]>): Locator {
    const real = this.#real.getByText(...args);
    const chainPath = extendChain(this.#identity.chainPath, "getByText", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath, this.#recorder, this.#matching);
  }

  getByTestId(...args: Parameters<Locator["getByTestId"]>): Locator {
    const real = this.#real.getByTestId(...args);
    const chainPath = extendChain(this.#identity.chainPath, "getByTestId", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath, this.#recorder, this.#matching);
  }

  getByPlaceholder(...args: Parameters<Locator["getByPlaceholder"]>): Locator {
    const real = this.#real.getByPlaceholder(...args);
    const chainPath = extendChain(this.#identity.chainPath, "getByPlaceholder", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath, this.#recorder, this.#matching);
  }

  // ---- imperative outcomes (Blueprint §7.1): try/catch shell, log, rethrow — no reaction yet ----

  async click(...args: Parameters<Locator["click"]>): ReturnType<Locator["click"]> {
    const capture = captureFingerprint(this.#real);
    try {
      const result = await this.#real.click(...args);
      logOutcome("click", "OK");
      this.#recordCapture(capture);
      return result;
    } catch (error) {
      logOutcome("click", "FAILED", messageOf(error));
      await this.#attemptHeal("click", error);
      throw error;
    }
  }

  async fill(...args: Parameters<Locator["fill"]>): ReturnType<Locator["fill"]> {
    const capture = captureFingerprint(this.#real);
    try {
      const result = await this.#real.fill(...args);
      logOutcome("fill", "OK");
      this.#recordCapture(capture);
      return result;
    } catch (error) {
      logOutcome("fill", "FAILED", messageOf(error));
      await this.#attemptHeal("fill", error);
      throw error;
    }
  }

  async type(...args: Parameters<Locator["type"]>): ReturnType<Locator["type"]> {
    const capture = captureFingerprint(this.#real);
    try {
      const result = await this.#real.type(...args);
      logOutcome("type", "OK");
      this.#recordCapture(capture);
      return result;
    } catch (error) {
      logOutcome("type", "FAILED", messageOf(error));
      await this.#attemptHeal("type", error);
      throw error;
    }
  }

  async press(...args: Parameters<Locator["press"]>): ReturnType<Locator["press"]> {
    const capture = captureFingerprint(this.#real);
    try {
      const result = await this.#real.press(...args);
      logOutcome("press", "OK");
      this.#recordCapture(capture);
      return result;
    } catch (error) {
      logOutcome("press", "FAILED", messageOf(error));
      await this.#attemptHeal("press", error);
      throw error;
    }
  }

  async check(...args: Parameters<Locator["check"]>): ReturnType<Locator["check"]> {
    const capture = captureFingerprint(this.#real);
    try {
      const result = await this.#real.check(...args);
      logOutcome("check", "OK");
      this.#recordCapture(capture);
      return result;
    } catch (error) {
      logOutcome("check", "FAILED", messageOf(error));
      await this.#attemptHeal("check", error);
      throw error;
    }
  }

  async uncheck(...args: Parameters<Locator["uncheck"]>): ReturnType<Locator["uncheck"]> {
    const capture = captureFingerprint(this.#real);
    try {
      const result = await this.#real.uncheck(...args);
      logOutcome("uncheck", "OK");
      this.#recordCapture(capture);
      return result;
    } catch (error) {
      logOutcome("uncheck", "FAILED", messageOf(error));
      await this.#attemptHeal("uncheck", error);
      throw error;
    }
  }

  async selectOption(
    ...args: Parameters<Locator["selectOption"]>
  ): ReturnType<Locator["selectOption"]> {
    const capture = captureFingerprint(this.#real);
    try {
      const result = await this.#real.selectOption(...args);
      logOutcome("selectOption", "OK");
      this.#recordCapture(capture);
      return result;
    } catch (error) {
      logOutcome("selectOption", "FAILED", messageOf(error));
      await this.#attemptHeal("selectOption", error);
      throw error;
    }
  }

  async hover(...args: Parameters<Locator["hover"]>): ReturnType<Locator["hover"]> {
    const capture = captureFingerprint(this.#real);
    try {
      const result = await this.#real.hover(...args);
      logOutcome("hover", "OK");
      this.#recordCapture(capture);
      return result;
    } catch (error) {
      logOutcome("hover", "FAILED", messageOf(error));
      await this.#attemptHeal("hover", error);
      throw error;
    }
  }

  async waitFor(...args: Parameters<Locator["waitFor"]>): ReturnType<Locator["waitFor"]> {
    const capture = captureFingerprint(this.#real);
    try {
      const result = await this.#real.waitFor(...args);
      logOutcome("waitFor", "OK");
      this.#recordCapture(capture);
      return result;
    } catch (error) {
      logOutcome("waitFor", "FAILED", messageOf(error));
      await this.#attemptHeal("waitFor", error);
      throw error;
    }
  }

  async innerText(...args: Parameters<Locator["innerText"]>): ReturnType<Locator["innerText"]> {
    const capture = captureFingerprint(this.#real);
    try {
      const result = await this.#real.innerText(...args);
      logOutcome("innerText", "OK");
      this.#recordCapture(capture);
      return result;
    } catch (error) {
      logOutcome("innerText", "FAILED", messageOf(error));
      await this.#attemptHeal("innerText", error);
      throw error;
    }
  }

  async textContent(
    ...args: Parameters<Locator["textContent"]>
  ): ReturnType<Locator["textContent"]> {
    const capture = captureFingerprint(this.#real);
    try {
      const result = await this.#real.textContent(...args);
      logOutcome("textContent", "OK");
      this.#recordCapture(capture);
      return result;
    } catch (error) {
      logOutcome("textContent", "FAILED", messageOf(error));
      await this.#attemptHeal("textContent", error);
      throw error;
    }
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

  // ---- everything else on Locator: plain pass-through, untouched (see NOTES.md RISK-004/005) ----

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

  and(...args: Parameters<Locator["and"]>): ReturnType<Locator["and"]> {
    return this.#real.and(...args);
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

  dragTo(...args: Parameters<Locator["dragTo"]>): ReturnType<Locator["dragTo"]> {
    return this.#real.dragTo(...args);
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

  filter(...args: Parameters<Locator["filter"]>): ReturnType<Locator["filter"]> {
    return this.#real.filter(...args);
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

  or(...args: Parameters<Locator["or"]>): ReturnType<Locator["or"]> {
    return this.#real.or(...args);
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
}
