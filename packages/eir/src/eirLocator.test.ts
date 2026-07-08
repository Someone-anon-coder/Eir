import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Locator, Page } from "@playwright/test";
import { EirLocator } from "./eirLocator.js";
import * as debugLog from "./debugLog.js";
import { CAPTURE_POINT_METHODS } from "./selectorIdentity.js";
import { IMPERATIVE_METHODS, INTERROGATIVE_METHODS } from "./methodClassification.js";
import type { MatchingContext } from "./matching/context.js";
import type { FingerprintRecorder } from "./store/fingerprintStore.js";

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

function fakeMatching(): MatchingContext {
  return { reader: { lookup: () => undefined }, log: { record: vi.fn() } };
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

    const eir = new EirLocator(real, [], fakeRecorder(), fakeMatching());
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
    const eir = new EirLocator(real, [], fakeRecorder(), fakeMatching());

    await eir.click();

    expect(real.click).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("click", "OK");
  });

  it("click() logs FAILED and rethrows the same error on failure", async () => {
    const logSpy = vi.spyOn(debugLog, "logOutcome");
    const failure = new Error("Timeout 5000ms exceeded waiting for locator");
    const real = fakeLocator({ click: vi.fn().mockRejectedValue(failure) });
    const eir = new EirLocator(real, [], fakeRecorder(), fakeMatching());

    await expect(eir.click()).rejects.toBe(failure);
    expect(logSpy).toHaveBeenCalledWith("click", "FAILED", failure.message);
  });
});

describe("interrogative outcomes", () => {
  it("isVisible() passes through with no logging, ever", async () => {
    const outcomeSpy = vi.spyOn(debugLog, "logOutcome");
    const capturedSpy = vi.spyOn(debugLog, "logCaptured");
    const real = fakeLocator({ isVisible: vi.fn().mockResolvedValue(true) });
    const eir = new EirLocator(real, [], fakeRecorder(), fakeMatching());

    const result = await eir.isVisible();

    expect(result).toBe(true);
    expect(outcomeSpy).not.toHaveBeenCalled();
    expect(capturedSpy).not.toHaveBeenCalled();
  });

  it("count() passes through with no logging, ever", async () => {
    const outcomeSpy = vi.spyOn(debugLog, "logOutcome");
    const real = fakeLocator({ count: vi.fn().mockResolvedValue(3) });
    const eir = new EirLocator(real, [], fakeRecorder(), fakeMatching());

    expect(await eir.count()).toBe(3);
    expect(outcomeSpy).not.toHaveBeenCalled();
  });
});

describe("plain pass-through", () => {
  it("boundingBox() delegates untouched", async () => {
    const box = { x: 0, y: 0, width: 10, height: 10 };
    const real = fakeLocator({ boundingBox: vi.fn().mockResolvedValue(box) });
    const eir = new EirLocator(real, [], fakeRecorder(), fakeMatching());

    expect(await eir.boundingBox()).toBe(box);
  });

  it("_apiName and _expect forward to the real locator's private internals", async () => {
    const real = fakeLocator({
      _apiName: "Locator",
      _expect: vi.fn().mockResolvedValue({ matches: true }),
    });
    const eir = new EirLocator(real, [], fakeRecorder(), fakeMatching());

    expect(eir._apiName).toBe("Locator");
    expect(await eir._expect("to.be.visible", { isNot: false, timeout: 1000 })).toEqual({
      matches: true,
    });
  });
});
