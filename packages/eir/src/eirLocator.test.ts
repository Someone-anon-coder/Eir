import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Locator, Page } from "@playwright/test";
import { EirLocator, unwrapHasOptions, unwrapLocator } from "./eirLocator.js";
import * as debugLog from "./debugLog.js";
import { CAPTURE_POINT_METHODS } from "./selectorIdentity.js";
import { IMPERATIVE_METHODS, INTERROGATIVE_METHODS } from "./methodClassification.js";
import type { MatchingContext } from "./matching/context.js";
import type { FingerprintRecorder } from "./store/fingerprintStore.js";
import type { PostConditionRecorder } from "./store/postConditionStore.js";

// Test double for Playwright's real Locator: only the members exercised by
// a given test are implemented; everything else is undefined and unused.
// Cast at the boundary is a test-double concern, not production code.
function fakeLocator(overrides: Record<string, unknown> = {}): Locator {
  const page = { url: () => "http://localhost:5173/dashboard/devices" } as unknown as Page;
  return {
    toString: () => "getByTestId('device-row-edit')",
    page: () => page,
    ...overrides,
  } as unknown as Locator;
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

beforeEach(() => {
  process.env["EIR_DEBUG"] = "1";
});

afterEach(() => {
  delete process.env["EIR_DEBUG"];
  vi.restoreAllMocks();
});

describe("classification table (Blueprint §7.1)", () => {
  it("capture points, imperative, and interrogative sets are disjoint", () => {
    const capture = new Set<string>(CAPTURE_POINT_METHODS);
    const imperative = new Set<string>(IMPERATIVE_METHODS);
    const interrogative = new Set<string>(INTERROGATIVE_METHODS);

    for (const name of imperative) expect(capture.has(name)).toBe(false);
    for (const name of interrogative) {
      expect(capture.has(name)).toBe(false);
      expect(imperative.has(name)).toBe(false);
    }
  });

  it("matches Blueprint §7.1's exact named lists", () => {
    expect([...CAPTURE_POINT_METHODS].sort()).toEqual(
      ["locator", "getByRole", "getByLabel", "getByText", "getByTestId", "getByPlaceholder"].sort(),
    );
    expect([...IMPERATIVE_METHODS].sort()).toEqual(
      [
        "click",
        "fill",
        "type",
        "press",
        "check",
        "uncheck",
        "selectOption",
        "hover",
        "waitFor",
        "innerText",
        "textContent",
      ].sort(),
    );
    expect([...INTERROGATIVE_METHODS].sort()).toEqual(
      ["isVisible", "isEnabled", "isChecked", "count"].sort(),
    );
  });
});

describe("capture points", () => {
  it("locator() delegates, logs, and returns an EirLocator with an extended chain", () => {
    const logSpy = vi.spyOn(debugLog, "logCaptured");
    const nested = fakeLocator();
    const real = fakeLocator({ locator: vi.fn().mockReturnValue(nested) });

    const eir = new EirLocator(
      real,
      [{ method: "getByText", args: ["Legacy Barcode Scanner"] }],
      fakeRecorder(),
      fakePostConditionRecorder(),
      fakeMatching(),
    );
    const result = eir.locator("xpath=ancestor::tr");

    expect(real.locator).toHaveBeenCalledWith("xpath=ancestor::tr");
    expect(result).toBeInstanceOf(EirLocator);
    expect((result as EirLocator).identity.chainPath).toEqual([
      { method: "getByText", args: ["Legacy Barcode Scanner"] },
      { method: "locator", args: ["xpath=ancestor::tr"] },
    ]);
    expect(logSpy).toHaveBeenCalledWith("getByTestId('device-row-edit')", "/dashboard/devices");
  });

  it("getByTestId() starts a fresh chain when called directly", () => {
    const nested = fakeLocator();
    const real = fakeLocator({ getByTestId: vi.fn().mockReturnValue(nested) });

    const eir = new EirLocator(real, [], fakeRecorder(), fakePostConditionRecorder(), fakeMatching());
    const result = eir.getByTestId("device-row-edit") as EirLocator;

    expect(result.identity.chainPath).toEqual([
      { method: "getByTestId", args: ["device-row-edit"] },
    ]);
  });
});

describe("imperative outcomes", () => {
  it("click() logs OK and returns the real result on success", async () => {
    const logSpy = vi.spyOn(debugLog, "logOutcome");
    const real = fakeLocator({ click: vi.fn().mockResolvedValue(undefined) });
    const eir = new EirLocator(real, [], fakeRecorder(), fakePostConditionRecorder(), fakeMatching());

    await eir.click();

    expect(real.click).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("click", "OK");
  });

  it("click() logs FAILED and rethrows the same error on failure", async () => {
    const logSpy = vi.spyOn(debugLog, "logOutcome");
    const failure = new Error("Timeout 5000ms exceeded waiting for locator");
    const real = fakeLocator({ click: vi.fn().mockRejectedValue(failure) });
    const eir = new EirLocator(real, [], fakeRecorder(), fakePostConditionRecorder(), fakeMatching());

    await expect(eir.click()).rejects.toBe(failure);
    expect(logSpy).toHaveBeenCalledWith("click", "FAILED", failure.message);
  });
});

describe("interrogative outcomes", () => {
  it("isVisible() passes through with no logging, ever", async () => {
    const outcomeSpy = vi.spyOn(debugLog, "logOutcome");
    const capturedSpy = vi.spyOn(debugLog, "logCaptured");
    const real = fakeLocator({ isVisible: vi.fn().mockResolvedValue(true) });
    const eir = new EirLocator(real, [], fakeRecorder(), fakePostConditionRecorder(), fakeMatching());

    const result = await eir.isVisible();

    expect(result).toBe(true);
    expect(outcomeSpy).not.toHaveBeenCalled();
    expect(capturedSpy).not.toHaveBeenCalled();
  });

  it("count() passes through with no logging, ever", async () => {
    const outcomeSpy = vi.spyOn(debugLog, "logOutcome");
    const real = fakeLocator({ count: vi.fn().mockResolvedValue(3) });
    const eir = new EirLocator(real, [], fakeRecorder(), fakePostConditionRecorder(), fakeMatching());

    expect(await eir.count()).toBe(3);
    expect(outcomeSpy).not.toHaveBeenCalled();
  });
});

describe("plain pass-through", () => {
  it("boundingBox() delegates untouched", async () => {
    const box = { x: 0, y: 0, width: 10, height: 10 };
    const real = fakeLocator({ boundingBox: vi.fn().mockResolvedValue(box) });
    const eir = new EirLocator(real, [], fakeRecorder(), fakePostConditionRecorder(), fakeMatching());

    expect(await eir.boundingBox()).toBe(box);
  });

  it("_apiName and _expect forward to the real locator's private internals", async () => {
    const real = fakeLocator({
      _apiName: "Locator",
      _expect: vi.fn().mockResolvedValue({ matches: true }),
    });
    const eir = new EirLocator(real, [], fakeRecorder(), fakePostConditionRecorder(), fakeMatching());

    expect(eir._apiName).toBe("Locator");
    expect(await eir._expect("to.be.visible", { isNot: false, timeout: 1000 })).toEqual({
      matches: true,
    });
  });
});

describe("NOTE-009/RISK-005: unwrapping an EirLocator passed as an argument", () => {
  function makeEir(real: Locator): EirLocator {
    return new EirLocator(real, [], fakeRecorder(), fakePostConditionRecorder(), fakeMatching());
  }

  describe("unwrapLocator", () => {
    it("returns the real Locator held by an EirLocator", () => {
      const real = fakeLocator();
      const eir = makeEir(real);

      expect(unwrapLocator(eir)).toBe(real);
    });

    it("returns a non-EirLocator argument untouched", () => {
      const real = fakeLocator();

      expect(unwrapLocator(real)).toBe(real);
    });
  });

  describe("unwrapHasOptions", () => {
    it("returns undefined untouched", () => {
      expect(unwrapHasOptions(undefined)).toBeUndefined();
    });

    it("returns the same object when neither has nor hasNot is present", () => {
      const options: { timeout: number; has?: Locator; hasNot?: Locator } = { timeout: 1000 };

      expect(unwrapHasOptions(options)).toBe(options);
    });

    it("unwraps has and hasNot when they are EirLocators, preserving other fields", () => {
      const hasReal = fakeLocator();
      const hasNotReal = fakeLocator();
      const options = { has: makeEir(hasReal), hasNot: makeEir(hasNotReal), timeout: 500 };

      const result = unwrapHasOptions(options);

      expect(result).toEqual({ has: hasReal, hasNot: hasNotReal, timeout: 500 });
    });

    it("leaves a real Locator's has/hasNot alone", () => {
      const hasReal = fakeLocator();
      const options = { has: hasReal };

      expect(unwrapHasOptions(options)).toBe(options);
    });
  });

  it("and() unwraps an EirLocator argument before delegating", () => {
    const otherReal = fakeLocator();
    const andSpy = vi.fn().mockReturnValue(fakeLocator());
    const real = fakeLocator({ and: andSpy });
    const eir = makeEir(real);
    const other = makeEir(otherReal);

    eir.and(other);

    expect(andSpy).toHaveBeenCalledWith(otherReal);
  });

  it("and() passes through a real Locator argument untouched", () => {
    const otherReal = fakeLocator();
    const andSpy = vi.fn().mockReturnValue(fakeLocator());
    const real = fakeLocator({ and: andSpy });
    const eir = makeEir(real);

    eir.and(otherReal);

    expect(andSpy).toHaveBeenCalledWith(otherReal);
  });

  it("or() unwraps an EirLocator argument before delegating", () => {
    const otherReal = fakeLocator();
    const orSpy = vi.fn().mockReturnValue(fakeLocator());
    const real = fakeLocator({ or: orSpy });
    const eir = makeEir(real);
    const other = makeEir(otherReal);

    eir.or(other);

    expect(orSpy).toHaveBeenCalledWith(otherReal);
  });

  it("dragTo() unwraps an EirLocator target, options included, before delegating", () => {
    const targetReal = fakeLocator();
    const dragToSpy = vi.fn().mockResolvedValue(undefined);
    const real = fakeLocator({ dragTo: dragToSpy });
    const eir = makeEir(real);
    const target = makeEir(targetReal);

    eir.dragTo(target, { force: true });

    expect(dragToSpy).toHaveBeenCalledWith(targetReal, { force: true });
  });

  it("dragTo() omits options entirely when none were passed (preserves arity)", () => {
    const targetReal = fakeLocator();
    const dragToSpy = vi.fn().mockResolvedValue(undefined);
    const real = fakeLocator({ dragTo: dragToSpy });
    const eir = makeEir(real);

    eir.dragTo(makeEir(targetReal));

    expect(dragToSpy).toHaveBeenCalledWith(targetReal);
  });

  it("filter() unwraps an EirLocator in options.has before delegating", () => {
    const hasReal = fakeLocator();
    const filterSpy = vi.fn().mockReturnValue(fakeLocator());
    const real = fakeLocator({ filter: filterSpy });
    const eir = makeEir(real);

    eir.filter({ has: makeEir(hasReal) });

    expect(filterSpy).toHaveBeenCalledWith({ has: hasReal });
  });

  it("filter() omits options entirely when none were passed (preserves arity)", () => {
    const filterSpy = vi.fn().mockReturnValue(fakeLocator());
    const real = fakeLocator({ filter: filterSpy });
    const eir = makeEir(real);

    eir.filter();

    expect(filterSpy).toHaveBeenCalledWith();
  });

  it("locator() unwraps an EirLocator passed as the selectorOrLocator argument", () => {
    const innerReal = fakeLocator();
    const locatorSpy = vi.fn().mockReturnValue(fakeLocator());
    const real = fakeLocator({ locator: locatorSpy });
    const eir = makeEir(real);

    eir.locator(makeEir(innerReal));

    expect(locatorSpy).toHaveBeenCalledWith(innerReal);
  });

  it("locator() unwraps an EirLocator in options.has, alongside a string selector", () => {
    const hasReal = fakeLocator();
    const locatorSpy = vi.fn().mockReturnValue(fakeLocator());
    const real = fakeLocator({ locator: locatorSpy });
    const eir = makeEir(real);

    eir.locator(".row", { has: makeEir(hasReal) });

    expect(locatorSpy).toHaveBeenCalledWith(".row", { has: hasReal });
  });
});
