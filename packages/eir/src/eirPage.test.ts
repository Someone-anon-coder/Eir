import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import type { Locator, Page } from "@playwright/test";
import { EirPage } from "./eirPage.js";
import { EirLocator } from "./eirLocator.js";
import * as debugLog from "./debugLog.js";
import type { MatchingContext } from "./matching/context.js";
import type { FingerprintRecorder } from "./store/fingerprintStore.js";
import type { PostConditionRecorder } from "./store/postConditionStore.js";

// Test double for Playwright's real Page: only members exercised by a given
// test are implemented. Cast at the boundary is a test-double concern, not
// production code.
function fakePage(overrides: Record<string, unknown> = {}): Page {
  return {
    url: () => "http://localhost:5173/dashboard/devices",
    ...overrides,
  } as unknown as Page;
}

function fakeRecorder(): FingerprintRecorder {
  return { record: vi.fn(), trackPending: vi.fn() };
}

function fakePostConditionRecorder(): PostConditionRecorder {
  return { record: vi.fn(), trackPending: vi.fn() };
}

function fakeMatching(): MatchingContext {
  return {
    reader: { lookup: () => undefined },
    log: { record: vi.fn() },
    postConditionReader: { lookup: () => undefined },
    mode: { mode: "suggest-only" },
    policyLog: { record: vi.fn() },
    annotate: vi.fn(),
    fallback: null,
  };
}

function fakeLocatorReturning(url: string): Locator {
  const page = { url: () => url } as unknown as Page;
  return {
    toString: () => "getByTestId('device-row-edit')",
    page: () => page,
  } as unknown as Locator;
}

beforeEach(() => {
  process.env["EIR_DEBUG"] = "1";
});

afterEach(() => {
  delete process.env["EIR_DEBUG"];
  vi.restoreAllMocks();
});

describe("capture points", () => {
  it("locator() wraps the result in an EirLocator with a fresh chain", () => {
    const logSpy = vi.spyOn(debugLog, "logCaptured");
    const nested = fakeLocatorReturning("http://localhost:5173/dashboard/devices");
    const real = fakePage({ locator: vi.fn().mockReturnValue(nested) });

    const eirPage = new EirPage(real, fakeRecorder(), fakePostConditionRecorder(), fakeMatching());
    const result = eirPage.locator("#login-username-input") as EirLocator;

    expect(real.locator).toHaveBeenCalledWith("#login-username-input");
    expect(result).toBeInstanceOf(EirLocator);
    expect(result.identity.chainPath).toEqual([
      { method: "locator", args: ["#login-username-input"] },
    ]);
    expect(logSpy).toHaveBeenCalledWith("getByTestId('device-row-edit')", "/dashboard/devices");
  });

  it("getByRole() wraps the result too", () => {
    const nested = fakeLocatorReturning("http://localhost:5173/dashboard/account");
    const real = fakePage({ getByRole: vi.fn().mockReturnValue(nested) });

    const eirPage = new EirPage(real, fakeRecorder(), fakePostConditionRecorder(), fakeMatching());
    const result = eirPage.getByRole("dialog", { name: "Delete Account?" }) as EirLocator;

    expect(real.getByRole).toHaveBeenCalledWith("dialog", { name: "Delete Account?" });
    expect(result.identity.chainPath).toEqual([
      { method: "getByRole", args: ["dialog", { name: "Delete Account?" }] },
    ]);
  });
});

describe("plain pass-through", () => {
  it("goto() delegates untouched", async () => {
    const real = fakePage({ goto: vi.fn().mockResolvedValue(null) });
    const eirPage = new EirPage(real, fakeRecorder(), fakePostConditionRecorder(), fakeMatching());

    await eirPage.goto("/login");

    expect(real.goto).toHaveBeenCalledWith("/login");
  });

  it("_apiName forwards to the real page's private internal", () => {
    const real = fakePage({ _apiName: "Page" });
    const eirPage = new EirPage(real, fakeRecorder(), fakePostConditionRecorder(), fakeMatching());

    expect(eirPage._apiName).toBe("Page");
  });
});

describe("removeAllListeners overload branching", () => {
  it("returns `this` for the no-options overload", () => {
    const real = fakePage({ removeAllListeners: vi.fn() });
    const eirPage = new EirPage(real, fakeRecorder(), fakePostConditionRecorder(), fakeMatching());

    const result = eirPage.removeAllListeners("close");

    expect(real.removeAllListeners).toHaveBeenCalledWith("close");
    expect(result).toBe(eirPage);
  });

  it("forwards the real Promise for the options overload", async () => {
    const promise = Promise.resolve();
    const real = fakePage({ removeAllListeners: vi.fn().mockReturnValue(promise) });
    const eirPage = new EirPage(real, fakeRecorder(), fakePostConditionRecorder(), fakeMatching());

    const result = eirPage.removeAllListeners("close", { behavior: "wait" });

    expect(real.removeAllListeners).toHaveBeenCalledWith("close", { behavior: "wait" });
    await expect(result).resolves.toBeUndefined();
  });
});

describe("NOTE-009/RISK-005: unwrapping an EirLocator passed as an argument", () => {
  function makeEirLocator(real: Locator): EirLocator {
    return new EirLocator(real, [], fakeRecorder(), fakePostConditionRecorder(), fakeMatching());
  }

  it("locator() unwraps an EirLocator in options.has, alongside a string selector", () => {
    const hasReal = fakeLocatorReturning("http://localhost:5173/dashboard/devices");
    const locatorSpy = vi.fn().mockReturnValue(fakeLocatorReturning("http://localhost:5173/dashboard/devices"));
    const real = fakePage({ locator: locatorSpy });
    const eirPage = new EirPage(real, fakeRecorder(), fakePostConditionRecorder(), fakeMatching());

    eirPage.locator(".row", { has: makeEirLocator(hasReal) });

    expect(locatorSpy).toHaveBeenCalledWith(".row", { has: hasReal });
  });

  it("locator() omits options entirely when none were passed (preserves arity)", () => {
    const locatorSpy = vi.fn().mockReturnValue(fakeLocatorReturning("http://localhost:5173/dashboard/devices"));
    const real = fakePage({ locator: locatorSpy });
    const eirPage = new EirPage(real, fakeRecorder(), fakePostConditionRecorder(), fakeMatching());

    eirPage.locator("#login-username-input");

    expect(locatorSpy).toHaveBeenCalledWith("#login-username-input");
  });

  it("addLocatorHandler() unwraps an EirLocator argument before delegating", () => {
    const handlerReal = fakeLocatorReturning("http://localhost:5173/dashboard/devices");
    const addSpy = vi.fn().mockResolvedValue(undefined);
    const real = fakePage({ addLocatorHandler: addSpy });
    const eirPage = new EirPage(real, fakeRecorder(), fakePostConditionRecorder(), fakeMatching());
    const handler = vi.fn();

    eirPage.addLocatorHandler(makeEirLocator(handlerReal), handler);

    expect(addSpy).toHaveBeenCalledWith(handlerReal, handler);
  });

  it("removeLocatorHandler() unwraps an EirLocator argument before delegating", () => {
    const targetReal = fakeLocatorReturning("http://localhost:5173/dashboard/devices");
    const removeSpy = vi.fn().mockResolvedValue(undefined);
    const real = fakePage({ removeLocatorHandler: removeSpy });
    const eirPage = new EirPage(real, fakeRecorder(), fakePostConditionRecorder(), fakeMatching());

    eirPage.removeLocatorHandler(makeEirLocator(targetReal));

    expect(removeSpy).toHaveBeenCalledWith(targetReal);
  });
});
