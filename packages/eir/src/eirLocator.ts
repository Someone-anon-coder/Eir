import type { Locator } from "@playwright/test";
import { logCaptured, logOutcome } from "./debugLog.js";
import { forwardOverloaded } from "./forwardOverloaded.js";
import {
  type ChainHop,
  type SelectorIdentity,
  extendChain,
  routeFromUrl,
} from "./selectorIdentity.js";

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

export class EirLocator implements Locator {
  readonly #real: Locator;
  readonly #identity: SelectorIdentity;

  constructor(real: Locator, chainPath: readonly ChainHop[]) {
    this.#real = real;
    this.#identity = {
      rawSelector: real.toString(),
      chainPath,
      routeAtCreation: routeFromUrl(real.page().url()),
    };
  }

  /** Not part of Playwright's `Locator` type — Eir's own book-keeping, read starting Phase 3. */
  get identity(): SelectorIdentity {
    return this.#identity;
  }

  // ---- capture points (Blueprint §7.1): wrap the returned Locator so chains stay tracked ----

  locator(...args: Parameters<Locator["locator"]>): Locator {
    const real = this.#real.locator(...args);
    const chainPath = extendChain(this.#identity.chainPath, "locator", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath);
  }

  getByRole(...args: Parameters<Locator["getByRole"]>): Locator {
    const real = this.#real.getByRole(...args);
    const chainPath = extendChain(this.#identity.chainPath, "getByRole", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath);
  }

  getByLabel(...args: Parameters<Locator["getByLabel"]>): Locator {
    const real = this.#real.getByLabel(...args);
    const chainPath = extendChain(this.#identity.chainPath, "getByLabel", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath);
  }

  getByText(...args: Parameters<Locator["getByText"]>): Locator {
    const real = this.#real.getByText(...args);
    const chainPath = extendChain(this.#identity.chainPath, "getByText", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath);
  }

  getByTestId(...args: Parameters<Locator["getByTestId"]>): Locator {
    const real = this.#real.getByTestId(...args);
    const chainPath = extendChain(this.#identity.chainPath, "getByTestId", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath);
  }

  getByPlaceholder(...args: Parameters<Locator["getByPlaceholder"]>): Locator {
    const real = this.#real.getByPlaceholder(...args);
    const chainPath = extendChain(this.#identity.chainPath, "getByPlaceholder", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath);
  }

  // ---- imperative outcomes (Blueprint §7.1): try/catch shell, log, rethrow — no reaction yet ----

  async click(...args: Parameters<Locator["click"]>): ReturnType<Locator["click"]> {
    try {
      const result = await this.#real.click(...args);
      logOutcome("click", "OK");
      return result;
    } catch (error) {
      logOutcome("click", "FAILED", messageOf(error));
      throw error;
    }
  }

  async fill(...args: Parameters<Locator["fill"]>): ReturnType<Locator["fill"]> {
    try {
      const result = await this.#real.fill(...args);
      logOutcome("fill", "OK");
      return result;
    } catch (error) {
      logOutcome("fill", "FAILED", messageOf(error));
      throw error;
    }
  }

  async type(...args: Parameters<Locator["type"]>): ReturnType<Locator["type"]> {
    try {
      const result = await this.#real.type(...args);
      logOutcome("type", "OK");
      return result;
    } catch (error) {
      logOutcome("type", "FAILED", messageOf(error));
      throw error;
    }
  }

  async press(...args: Parameters<Locator["press"]>): ReturnType<Locator["press"]> {
    try {
      const result = await this.#real.press(...args);
      logOutcome("press", "OK");
      return result;
    } catch (error) {
      logOutcome("press", "FAILED", messageOf(error));
      throw error;
    }
  }

  async check(...args: Parameters<Locator["check"]>): ReturnType<Locator["check"]> {
    try {
      const result = await this.#real.check(...args);
      logOutcome("check", "OK");
      return result;
    } catch (error) {
      logOutcome("check", "FAILED", messageOf(error));
      throw error;
    }
  }

  async uncheck(...args: Parameters<Locator["uncheck"]>): ReturnType<Locator["uncheck"]> {
    try {
      const result = await this.#real.uncheck(...args);
      logOutcome("uncheck", "OK");
      return result;
    } catch (error) {
      logOutcome("uncheck", "FAILED", messageOf(error));
      throw error;
    }
  }

  async selectOption(
    ...args: Parameters<Locator["selectOption"]>
  ): ReturnType<Locator["selectOption"]> {
    try {
      const result = await this.#real.selectOption(...args);
      logOutcome("selectOption", "OK");
      return result;
    } catch (error) {
      logOutcome("selectOption", "FAILED", messageOf(error));
      throw error;
    }
  }

  async hover(...args: Parameters<Locator["hover"]>): ReturnType<Locator["hover"]> {
    try {
      const result = await this.#real.hover(...args);
      logOutcome("hover", "OK");
      return result;
    } catch (error) {
      logOutcome("hover", "FAILED", messageOf(error));
      throw error;
    }
  }

  async waitFor(...args: Parameters<Locator["waitFor"]>): ReturnType<Locator["waitFor"]> {
    try {
      const result = await this.#real.waitFor(...args);
      logOutcome("waitFor", "OK");
      return result;
    } catch (error) {
      logOutcome("waitFor", "FAILED", messageOf(error));
      throw error;
    }
  }

  async innerText(
    ...args: Parameters<Locator["innerText"]>
  ): ReturnType<Locator["innerText"]> {
    try {
      const result = await this.#real.innerText(...args);
      logOutcome("innerText", "OK");
      return result;
    } catch (error) {
      logOutcome("innerText", "FAILED", messageOf(error));
      throw error;
    }
  }

  async textContent(
    ...args: Parameters<Locator["textContent"]>
  ): ReturnType<Locator["textContent"]> {
    try {
      const result = await this.#real.textContent(...args);
      logOutcome("textContent", "OK");
      return result;
    } catch (error) {
      logOutcome("textContent", "FAILED", messageOf(error));
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

  allInnerTexts(...args: Parameters<Locator["allInnerTexts"]>): ReturnType<Locator["allInnerTexts"]> {
    return this.#real.allInnerTexts(...args);
  }

  allTextContents(...args: Parameters<Locator["allTextContents"]>): ReturnType<Locator["allTextContents"]> {
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

  dispatchEvent(...args: Parameters<Locator["dispatchEvent"]>): ReturnType<Locator["dispatchEvent"]> {
    return this.#real.dispatchEvent(...args);
  }

  dragTo(...args: Parameters<Locator["dragTo"]>): ReturnType<Locator["dragTo"]> {
    return this.#real.dragTo(...args);
  }

  drop(...args: Parameters<Locator["drop"]>): ReturnType<Locator["drop"]> {
    return this.#real.drop(...args);
  }

  elementHandle(...args: Parameters<Locator["elementHandle"]>): ReturnType<Locator["elementHandle"]> {
    return this.#real.elementHandle(...args);
  }

  elementHandles(...args: Parameters<Locator["elementHandles"]>): ReturnType<Locator["elementHandles"]> {
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

  hideHighlight(...args: Parameters<Locator["hideHighlight"]>): ReturnType<Locator["hideHighlight"]> {
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

  setInputFiles(...args: Parameters<Locator["setInputFiles"]>): ReturnType<Locator["setInputFiles"]> {
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

  readonly evaluateHandle: Locator["evaluateHandle"] = forwardOverloaded(
    (...args: unknown[]) =>
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
