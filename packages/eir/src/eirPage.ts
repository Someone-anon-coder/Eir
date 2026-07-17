import type { Page } from "@playwright/test";
import { EirLocator, unwrapHasOptions, unwrapLocator } from "./eirLocator.js";
import { logCaptured } from "./debugLog.js";
import { forwardOverloaded } from "./forwardOverloaded.js";
import type { MatchingContext } from "./matching/context.js";
import { extendChain, routeFromUrl } from "./selectorIdentity.js";
import type { FingerprintRecorder } from "./store/fingerprintStore.js";
import type { PostConditionRecorder } from "./store/postConditionStore.js";

/**
 * `expect(page).toHaveURL()` / `.toHaveTitle()` duck-type `_apiName` on the
 * receiver (`expectTypes` in Playwright's matcher internals) but route their
 * actual polling through `page.mainFrame()._expect(...)` — a plain
 * pass-through already returning the real `Frame` — so only `_apiName`
 * needed forwarding for those two. `expect(page).toHaveScreenshot()` is
 * different: it calls `pageOrLocator._expectScreenshot(...)` directly on
 * whichever receiver `expect()` was given, so `EirPage` itself needs the
 * method forwarded (B2/RISK-003, 1.0.0 closure — confirmed via a real
 * `toHaveScreenshot()` run: `TypeError: page._expectScreenshot is not a
 * function` before this fix).
 */
interface PagePrivateInternals {
  readonly _apiName: unknown;
  _expectScreenshot(...args: unknown[]): unknown;
}

function internalsOf(real: Page): PagePrivateInternals {
  return real as unknown as PagePrivateInternals;
}

export class EirPage implements Page {
  readonly #real: Page;
  readonly #recorder: FingerprintRecorder;
  readonly #postConditionRecorder: PostConditionRecorder;
  readonly #matching: MatchingContext;

  constructor(
    real: Page,
    recorder: FingerprintRecorder,
    postConditionRecorder: PostConditionRecorder,
    matching: MatchingContext,
  ) {
    this.#real = real;
    this.#recorder = recorder;
    this.#postConditionRecorder = postConditionRecorder;
    this.#matching = matching;
  }

  // ---- capture points (Blueprint §7.1): wrap the returned Locator so chains stay tracked ----

  locator(...args: Parameters<Page["locator"]>): ReturnType<Page["locator"]> {
    // NOTE-009/RISK-005: `Page.locator`'s selector is always a `string`
    // (unlike `Locator.locator`, which also accepts a `Locator`) — only
    // `options.has`/`hasNot` can carry one here.
    const [selector, options] = args;
    const unwrappedOptions = unwrapHasOptions(options);
    const real =
      unwrappedOptions === undefined
        ? this.#real.locator(selector)
        : this.#real.locator(selector, unwrappedOptions);
    const chainPath = extendChain([], "locator", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath, this.#recorder, this.#postConditionRecorder, this.#matching);
  }

  getByRole(...args: Parameters<Page["getByRole"]>): ReturnType<Page["getByRole"]> {
    const real = this.#real.getByRole(...args);
    const chainPath = extendChain([], "getByRole", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath, this.#recorder, this.#postConditionRecorder, this.#matching);
  }

  getByLabel(...args: Parameters<Page["getByLabel"]>): ReturnType<Page["getByLabel"]> {
    const real = this.#real.getByLabel(...args);
    const chainPath = extendChain([], "getByLabel", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath, this.#recorder, this.#postConditionRecorder, this.#matching);
  }

  getByText(...args: Parameters<Page["getByText"]>): ReturnType<Page["getByText"]> {
    const real = this.#real.getByText(...args);
    const chainPath = extendChain([], "getByText", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath, this.#recorder, this.#postConditionRecorder, this.#matching);
  }

  getByTestId(...args: Parameters<Page["getByTestId"]>): ReturnType<Page["getByTestId"]> {
    const real = this.#real.getByTestId(...args);
    const chainPath = extendChain([], "getByTestId", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath, this.#recorder, this.#postConditionRecorder, this.#matching);
  }

  getByPlaceholder(
    ...args: Parameters<Page["getByPlaceholder"]>
  ): ReturnType<Page["getByPlaceholder"]> {
    const real = this.#real.getByPlaceholder(...args);
    const chainPath = extendChain([], "getByPlaceholder", args);
    logCaptured(real.toString(), routeFromUrl(real.page().url()));
    return new EirLocator(real, chainPath, this.#recorder, this.#postConditionRecorder, this.#matching);
  }

  // ---- everything else on Page: plain pass-through, untouched (Blueprint §7.1 scopes ----
  // ---- the imperative try/catch shell to wrapped Locators only, not Page's legacy   ----
  // ---- selector-taking methods like page.click(selector) — see NOTES.md RISK-004)   ----

  // ---- generic/overloaded members: Parameters<>/ReturnType<> only see the last ----
  // ---- overload, so these are typed as full properties instead (Aayush-approved). ----
  // ---- `on`/`off`/etc. return `this` for chaining in the real Page interface;      ----
  // ---- returning `this` here (not the real Page) keeps chained calls wrapped too.  ----

  addListener(...args: unknown[]) {
    (this.#real.addListener as (...a: unknown[]) => unknown)(...args);
    return this;
  }

  // NOTE-009/RISK-005: the `locator` argument must be a real `Locator`.
  // `handler` is unaffected — Playwright invokes it with a real `Locator`
  // it resolves itself, never with anything Eir constructs.
  addLocatorHandler(
    ...args: Parameters<Page["addLocatorHandler"]>
  ): ReturnType<Page["addLocatorHandler"]> {
    const [locator, ...rest] = args;
    return this.#real.addLocatorHandler(unwrapLocator(locator), ...rest);
  }

  addScriptTag(...args: Parameters<Page["addScriptTag"]>): ReturnType<Page["addScriptTag"]> {
    return this.#real.addScriptTag(...args);
  }

  addStyleTag(...args: Parameters<Page["addStyleTag"]>): ReturnType<Page["addStyleTag"]> {
    return this.#real.addStyleTag(...args);
  }

  ariaSnapshot(...args: Parameters<Page["ariaSnapshot"]>): ReturnType<Page["ariaSnapshot"]> {
    return this.#real.ariaSnapshot(...args);
  }

  bringToFront(...args: Parameters<Page["bringToFront"]>): ReturnType<Page["bringToFront"]> {
    return this.#real.bringToFront(...args);
  }

  cancelPickLocator(
    ...args: Parameters<Page["cancelPickLocator"]>
  ): ReturnType<Page["cancelPickLocator"]> {
    return this.#real.cancelPickLocator(...args);
  }

  check(...args: Parameters<Page["check"]>): ReturnType<Page["check"]> {
    return this.#real.check(...args);
  }

  clearConsoleMessages(
    ...args: Parameters<Page["clearConsoleMessages"]>
  ): ReturnType<Page["clearConsoleMessages"]> {
    return this.#real.clearConsoleMessages(...args);
  }

  clearPageErrors(
    ...args: Parameters<Page["clearPageErrors"]>
  ): ReturnType<Page["clearPageErrors"]> {
    return this.#real.clearPageErrors(...args);
  }

  click(...args: Parameters<Page["click"]>): ReturnType<Page["click"]> {
    return this.#real.click(...args);
  }

  close(...args: Parameters<Page["close"]>): ReturnType<Page["close"]> {
    return this.#real.close(...args);
  }

  consoleMessages(
    ...args: Parameters<Page["consoleMessages"]>
  ): ReturnType<Page["consoleMessages"]> {
    return this.#real.consoleMessages(...args);
  }

  content(...args: Parameters<Page["content"]>): ReturnType<Page["content"]> {
    return this.#real.content(...args);
  }

  context(...args: Parameters<Page["context"]>): ReturnType<Page["context"]> {
    return this.#real.context(...args);
  }

  dblclick(...args: Parameters<Page["dblclick"]>): ReturnType<Page["dblclick"]> {
    return this.#real.dblclick(...args);
  }

  dispatchEvent(...args: Parameters<Page["dispatchEvent"]>): ReturnType<Page["dispatchEvent"]> {
    return this.#real.dispatchEvent(...args);
  }

  dragAndDrop(...args: Parameters<Page["dragAndDrop"]>): ReturnType<Page["dragAndDrop"]> {
    return this.#real.dragAndDrop(...args);
  }

  emulateMedia(...args: Parameters<Page["emulateMedia"]>): ReturnType<Page["emulateMedia"]> {
    return this.#real.emulateMedia(...args);
  }

  exposeBinding(...args: Parameters<Page["exposeBinding"]>): ReturnType<Page["exposeBinding"]> {
    return this.#real.exposeBinding(...args);
  }

  exposeFunction(...args: Parameters<Page["exposeFunction"]>): ReturnType<Page["exposeFunction"]> {
    return this.#real.exposeFunction(...args);
  }

  fill(...args: Parameters<Page["fill"]>): ReturnType<Page["fill"]> {
    return this.#real.fill(...args);
  }

  focus(...args: Parameters<Page["focus"]>): ReturnType<Page["focus"]> {
    return this.#real.focus(...args);
  }

  frame(...args: Parameters<Page["frame"]>): ReturnType<Page["frame"]> {
    return this.#real.frame(...args);
  }

  frameLocator(...args: Parameters<Page["frameLocator"]>): ReturnType<Page["frameLocator"]> {
    return this.#real.frameLocator(...args);
  }

  frames(...args: Parameters<Page["frames"]>): ReturnType<Page["frames"]> {
    return this.#real.frames(...args);
  }

  getAttribute(...args: Parameters<Page["getAttribute"]>): ReturnType<Page["getAttribute"]> {
    return this.#real.getAttribute(...args);
  }

  getByAltText(...args: Parameters<Page["getByAltText"]>): ReturnType<Page["getByAltText"]> {
    return this.#real.getByAltText(...args);
  }

  getByTitle(...args: Parameters<Page["getByTitle"]>): ReturnType<Page["getByTitle"]> {
    return this.#real.getByTitle(...args);
  }

  goBack(...args: Parameters<Page["goBack"]>): ReturnType<Page["goBack"]> {
    return this.#real.goBack(...args);
  }

  goForward(...args: Parameters<Page["goForward"]>): ReturnType<Page["goForward"]> {
    return this.#real.goForward(...args);
  }

  goto(...args: Parameters<Page["goto"]>): ReturnType<Page["goto"]> {
    return this.#real.goto(...args);
  }

  hideHighlight(...args: Parameters<Page["hideHighlight"]>): ReturnType<Page["hideHighlight"]> {
    return this.#real.hideHighlight(...args);
  }

  hover(...args: Parameters<Page["hover"]>): ReturnType<Page["hover"]> {
    return this.#real.hover(...args);
  }

  innerHTML(...args: Parameters<Page["innerHTML"]>): ReturnType<Page["innerHTML"]> {
    return this.#real.innerHTML(...args);
  }

  innerText(...args: Parameters<Page["innerText"]>): ReturnType<Page["innerText"]> {
    return this.#real.innerText(...args);
  }

  inputValue(...args: Parameters<Page["inputValue"]>): ReturnType<Page["inputValue"]> {
    return this.#real.inputValue(...args);
  }

  isChecked(...args: Parameters<Page["isChecked"]>): ReturnType<Page["isChecked"]> {
    return this.#real.isChecked(...args);
  }

  isClosed(...args: Parameters<Page["isClosed"]>): ReturnType<Page["isClosed"]> {
    return this.#real.isClosed(...args);
  }

  isDisabled(...args: Parameters<Page["isDisabled"]>): ReturnType<Page["isDisabled"]> {
    return this.#real.isDisabled(...args);
  }

  isEditable(...args: Parameters<Page["isEditable"]>): ReturnType<Page["isEditable"]> {
    return this.#real.isEditable(...args);
  }

  isEnabled(...args: Parameters<Page["isEnabled"]>): ReturnType<Page["isEnabled"]> {
    return this.#real.isEnabled(...args);
  }

  isHidden(...args: Parameters<Page["isHidden"]>): ReturnType<Page["isHidden"]> {
    return this.#real.isHidden(...args);
  }

  isVisible(...args: Parameters<Page["isVisible"]>): ReturnType<Page["isVisible"]> {
    return this.#real.isVisible(...args);
  }

  mainFrame(...args: Parameters<Page["mainFrame"]>): ReturnType<Page["mainFrame"]> {
    return this.#real.mainFrame(...args);
  }

  off(...args: unknown[]) {
    (this.#real.off as (...a: unknown[]) => unknown)(...args);
    return this;
  }

  on(...args: unknown[]) {
    (this.#real.on as (...a: unknown[]) => unknown)(...args);
    return this;
  }

  once(...args: unknown[]) {
    (this.#real.once as (...a: unknown[]) => unknown)(...args);
    return this;
  }

  opener(...args: Parameters<Page["opener"]>): ReturnType<Page["opener"]> {
    return this.#real.opener(...args);
  }

  pageErrors(...args: Parameters<Page["pageErrors"]>): ReturnType<Page["pageErrors"]> {
    return this.#real.pageErrors(...args);
  }

  pause(...args: Parameters<Page["pause"]>): ReturnType<Page["pause"]> {
    return this.#real.pause(...args);
  }

  pdf(...args: Parameters<Page["pdf"]>): ReturnType<Page["pdf"]> {
    return this.#real.pdf(...args);
  }

  pickLocator(...args: Parameters<Page["pickLocator"]>): ReturnType<Page["pickLocator"]> {
    return this.#real.pickLocator(...args);
  }

  prependListener(...args: unknown[]) {
    (this.#real.prependListener as (...a: unknown[]) => unknown)(...args);
    return this;
  }

  press(...args: Parameters<Page["press"]>): ReturnType<Page["press"]> {
    return this.#real.press(...args);
  }

  reload(...args: Parameters<Page["reload"]>): ReturnType<Page["reload"]> {
    return this.#real.reload(...args);
  }

  // `removeAllListeners`'s two overloads return different types (`this` for
  // the common no-options case, `Promise<void>` for the rare `{ behavior }`
  // form) — hand-written here (only 2 signatures) since Parameters<>/
  // ReturnType<> can't express either without collapsing to one.
  removeAllListeners(type?: string): this;
  removeAllListeners(
    type: string | undefined,
    options: { behavior?: "wait" | "ignoreErrors" | "default" },
  ): Promise<void>;
  removeAllListeners(...args: unknown[]): this | Promise<void> {
    const result = (this.#real.removeAllListeners as (...a: unknown[]) => unknown)(...args);
    return args.length > 1 ? (result as Promise<void>) : this;
  }

  removeListener(...args: unknown[]) {
    (this.#real.removeListener as (...a: unknown[]) => unknown)(...args);
    return this;
  }

  removeLocatorHandler(
    ...args: Parameters<Page["removeLocatorHandler"]>
  ): ReturnType<Page["removeLocatorHandler"]> {
    const [locator] = args;
    return this.#real.removeLocatorHandler(unwrapLocator(locator));
  }

  requestGC(...args: Parameters<Page["requestGC"]>): ReturnType<Page["requestGC"]> {
    return this.#real.requestGC(...args);
  }

  requests(...args: Parameters<Page["requests"]>): ReturnType<Page["requests"]> {
    return this.#real.requests(...args);
  }

  route(...args: Parameters<Page["route"]>): ReturnType<Page["route"]> {
    return this.#real.route(...args);
  }

  routeFromHAR(...args: Parameters<Page["routeFromHAR"]>): ReturnType<Page["routeFromHAR"]> {
    return this.#real.routeFromHAR(...args);
  }

  routeWebSocket(...args: Parameters<Page["routeWebSocket"]>): ReturnType<Page["routeWebSocket"]> {
    return this.#real.routeWebSocket(...args);
  }

  screenshot(...args: Parameters<Page["screenshot"]>): ReturnType<Page["screenshot"]> {
    return this.#real.screenshot(...args);
  }

  selectOption(...args: Parameters<Page["selectOption"]>): ReturnType<Page["selectOption"]> {
    return this.#real.selectOption(...args);
  }

  setChecked(...args: Parameters<Page["setChecked"]>): ReturnType<Page["setChecked"]> {
    return this.#real.setChecked(...args);
  }

  setContent(...args: Parameters<Page["setContent"]>): ReturnType<Page["setContent"]> {
    return this.#real.setContent(...args);
  }

  setDefaultNavigationTimeout(
    ...args: Parameters<Page["setDefaultNavigationTimeout"]>
  ): ReturnType<Page["setDefaultNavigationTimeout"]> {
    return this.#real.setDefaultNavigationTimeout(...args);
  }

  setDefaultTimeout(
    ...args: Parameters<Page["setDefaultTimeout"]>
  ): ReturnType<Page["setDefaultTimeout"]> {
    return this.#real.setDefaultTimeout(...args);
  }

  setExtraHTTPHeaders(
    ...args: Parameters<Page["setExtraHTTPHeaders"]>
  ): ReturnType<Page["setExtraHTTPHeaders"]> {
    return this.#real.setExtraHTTPHeaders(...args);
  }

  setInputFiles(...args: Parameters<Page["setInputFiles"]>): ReturnType<Page["setInputFiles"]> {
    return this.#real.setInputFiles(...args);
  }

  setViewportSize(
    ...args: Parameters<Page["setViewportSize"]>
  ): ReturnType<Page["setViewportSize"]> {
    return this.#real.setViewportSize(...args);
  }

  tap(...args: Parameters<Page["tap"]>): ReturnType<Page["tap"]> {
    return this.#real.tap(...args);
  }

  textContent(...args: Parameters<Page["textContent"]>): ReturnType<Page["textContent"]> {
    return this.#real.textContent(...args);
  }

  title(...args: Parameters<Page["title"]>): ReturnType<Page["title"]> {
    return this.#real.title(...args);
  }

  type(...args: Parameters<Page["type"]>): ReturnType<Page["type"]> {
    return this.#real.type(...args);
  }

  uncheck(...args: Parameters<Page["uncheck"]>): ReturnType<Page["uncheck"]> {
    return this.#real.uncheck(...args);
  }

  unroute(...args: Parameters<Page["unroute"]>): ReturnType<Page["unroute"]> {
    return this.#real.unroute(...args);
  }

  unrouteAll(...args: Parameters<Page["unrouteAll"]>): ReturnType<Page["unrouteAll"]> {
    return this.#real.unrouteAll(...args);
  }

  url(...args: Parameters<Page["url"]>): ReturnType<Page["url"]> {
    return this.#real.url(...args);
  }

  video(...args: Parameters<Page["video"]>): ReturnType<Page["video"]> {
    return this.#real.video(...args);
  }

  viewportSize(...args: Parameters<Page["viewportSize"]>): ReturnType<Page["viewportSize"]> {
    return this.#real.viewportSize(...args);
  }

  readonly waitForEvent: Page["waitForEvent"] = forwardOverloaded((...args: unknown[]) =>
    (this.#real.waitForEvent as (...a: unknown[]) => unknown)(...args),
  );

  waitForLoadState(
    ...args: Parameters<Page["waitForLoadState"]>
  ): ReturnType<Page["waitForLoadState"]> {
    return this.#real.waitForLoadState(...args);
  }

  waitForNavigation(
    ...args: Parameters<Page["waitForNavigation"]>
  ): ReturnType<Page["waitForNavigation"]> {
    return this.#real.waitForNavigation(...args);
  }

  waitForRequest(...args: Parameters<Page["waitForRequest"]>): ReturnType<Page["waitForRequest"]> {
    return this.#real.waitForRequest(...args);
  }

  waitForResponse(
    ...args: Parameters<Page["waitForResponse"]>
  ): ReturnType<Page["waitForResponse"]> {
    return this.#real.waitForResponse(...args);
  }

  readonly waitForSelector: Page["waitForSelector"] = forwardOverloaded((...args: unknown[]) =>
    (this.#real.waitForSelector as (...a: unknown[]) => unknown)(...args),
  );

  waitForTimeout(...args: Parameters<Page["waitForTimeout"]>): ReturnType<Page["waitForTimeout"]> {
    return this.#real.waitForTimeout(...args);
  }

  waitForURL(...args: Parameters<Page["waitForURL"]>): ReturnType<Page["waitForURL"]> {
    return this.#real.waitForURL(...args);
  }

  workers(...args: Parameters<Page["workers"]>): ReturnType<Page["workers"]> {
    return this.#real.workers(...args);
  }

  // ---- more generic members, same reason as the block above ----

  readonly $: Page["$"] = forwardOverloaded((...args: unknown[]) =>
    (this.#real.$ as (...a: unknown[]) => unknown)(...args),
  );

  readonly $$: Page["$$"] = forwardOverloaded((...args: unknown[]) =>
    (this.#real.$$ as (...a: unknown[]) => unknown)(...args),
  );

  readonly $eval: Page["$eval"] = forwardOverloaded((...args: unknown[]) =>
    (this.#real.$eval as (...a: unknown[]) => unknown)(...args),
  );

  readonly $$eval: Page["$$eval"] = forwardOverloaded((...args: unknown[]) =>
    (this.#real.$$eval as (...a: unknown[]) => unknown)(...args),
  );

  readonly addInitScript: Page["addInitScript"] = forwardOverloaded((...args: unknown[]) =>
    (this.#real.addInitScript as (...a: unknown[]) => unknown)(...args),
  );

  readonly evaluate: Page["evaluate"] = forwardOverloaded((...args: unknown[]) =>
    (this.#real.evaluate as (...a: unknown[]) => unknown)(...args),
  );

  readonly evaluateHandle: Page["evaluateHandle"] = forwardOverloaded((...args: unknown[]) =>
    (this.#real.evaluateHandle as (...a: unknown[]) => unknown)(...args),
  );

  readonly waitForFunction: Page["waitForFunction"] = forwardOverloaded((...args: unknown[]) =>
    (this.#real.waitForFunction as (...a: unknown[]) => unknown)(...args),
  );

  // ---- readonly properties: plain pass-through getters ----

  get clock(): Page["clock"] {
    return this.#real.clock;
  }

  get coverage(): Page["coverage"] {
    return this.#real.coverage;
  }

  get keyboard(): Page["keyboard"] {
    return this.#real.keyboard;
  }

  get localStorage(): Page["localStorage"] {
    return this.#real.localStorage;
  }

  get mouse(): Page["mouse"] {
    return this.#real.mouse;
  }

  get request(): Page["request"] {
    return this.#real.request;
  }

  get screencast(): Page["screencast"] {
    return this.#real.screencast;
  }

  get sessionStorage(): Page["sessionStorage"] {
    return this.#real.sessionStorage;
  }

  get touchscreen(): Page["touchscreen"] {
    return this.#real.touchscreen;
  }

  // ---- explicit resource management (`await using page = ...`) ----

  [Symbol.asyncDispose](): Promise<void> {
    return this.#real[Symbol.asyncDispose]();
  }

  // ---- private runtime hooks expect(page) assertions need; not part of the public Page type ----

  get _apiName(): unknown {
    return internalsOf(this.#real)._apiName;
  }

  // B2/RISK-003 (1.0.0 closure): makes expect(eirPage).toHaveScreenshot() work.
  _expectScreenshot(...args: unknown[]): unknown {
    return internalsOf(this.#real)._expectScreenshot(...args);
  }
}
