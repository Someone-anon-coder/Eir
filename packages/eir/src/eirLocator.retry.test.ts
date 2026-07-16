import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Locator, Page } from "@playwright/test";

vi.mock("./matching/matcher.js", () => ({ attemptMatch: vi.fn() }));
vi.mock("./capture/captureFingerprint.js", () => ({ captureFingerprint: vi.fn().mockResolvedValue(null) }));
vi.mock("./capture/capturePulse.js", () => ({ capturePulse: vi.fn() }));

import { EirLocator } from "./eirLocator.js";
import { capturePulse } from "./capture/capturePulse.js";
import { attemptMatch, type MatchAttempt } from "./matching/matcher.js";
import type { MatchingContext } from "./matching/context.js";
import type { EirMode } from "./policy/eirMode.js";
import type { PostCondition } from "./postCondition.js";
import type { FingerprintRecorder } from "./store/fingerprintStore.js";
import type { PostConditionRecorder } from "./store/postConditionStore.js";

/**
 * Retry-once semantics (Phase 6's own Understanding Gate, confirmed
 * before this code was written): a healed retry either genuinely healed,
 * or backs out to the *original* failure — never the retry's own error,
 * never a silent pass. `attemptMatch`/`capturePulse` are mocked so these
 * tests exercise `EirLocator`'s own orchestration (which action to call,
 * what to verify, what to rethrow) independent of the real matching
 * funnel — that funnel already has its own tests (`matcher.test.ts`).
 */

const MATCHED: Extract<MatchAttempt, { kind: "matched" }> = {
  kind: "matched",
  fingerprint: {
    v: 1,
    tag: "button",
    attrs: { "data-testid": "device-row-remove" },
    text: "Remove",
    label: null,
    ancestors: [],
    siblingIndex: 0,
    siblingCount: 1,
    bbox: { x: 100, y: 200, w: 64, h: 32 },
  },
  candidateCount: 1,
  winner: {
    tag: "button",
    attrs: { "data-testid": "device-row-remove" },
    text: "Remove",
    label: null,
    ancestors: [],
    siblingIndex: 0,
    siblingCount: 1,
    bbox: { x: 100, y: 208, w: 64, h: 32 },
  },
  breakdown: {
    attrOverlap: 1,
    textSimilarity: 1,
    labelMatch: 1,
    ancestorChain: 1,
    siblingPosition: 1,
    bboxProximity: 0.95,
  },
  confidence: 0.9,
  margin: 0.3,
  suggestion: null,
  winnerLocator: { selector: '[data-testid="device-row-remove"]', domIndex: 0 },
  shortlist: [],
};

const HEAL_MODE: EirMode = { mode: "heal", healThreshold: 0.7, suggestThreshold: 0.3 };
const SUGGEST_ONLY: EirMode = { mode: "suggest-only" };

function fakeCandidateLocator(overrides: Record<string, unknown> = {}): Locator {
  return {
    click: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(Buffer.from("png")),
    ...overrides,
  } as unknown as Locator;
}

function fakePage(candidateLocator: Locator): Page {
  return {
    url: () => "http://localhost:5173/dashboard/devices",
    evaluate: vi.fn().mockResolvedValue("complete"),
    locator: vi.fn().mockReturnValue({ nth: vi.fn().mockReturnValue(candidateLocator) }),
  } as unknown as Page;
}

function fakeOriginalLocator(page: Page, overrides: Record<string, unknown> = {}): Locator {
  return {
    toString: () => "getByTestId('device-row-remove')",
    page: () => page,
    click: vi.fn().mockRejectedValue(new Error("Timeout 5000ms exceeded waiting for locator")),
    ...overrides,
  } as unknown as Locator;
}

function fakeRecorder(): FingerprintRecorder {
  return { record: vi.fn(), trackPending: vi.fn() };
}

function fakePostConditionRecorder(): PostConditionRecorder {
  return { record: vi.fn(), trackPending: vi.fn() };
}

function fakeMatching(mode: EirMode, storedPostCondition?: PostCondition): MatchingContext {
  return {
    reader: { lookup: () => undefined },
    log: { record: vi.fn() },
    postConditionReader: { lookup: () => storedPostCondition },
    mode,
    policyLog: { record: vi.fn() },
    annotate: vi.fn(),
    fallback: null,
  };
}

beforeEach(() => {
  vi.mocked(attemptMatch).mockResolvedValue(MATCHED);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("suggest-only mode", () => {
  it("never retries, even when confidence and margin comfortably clear the heal bar", async () => {
    const candidate = fakeCandidateLocator();
    const page = fakePage(candidate);
    const real = fakeOriginalLocator(page);
    const matching = fakeMatching(SUGGEST_ONLY);
    const eir = new EirLocator(real, [{ method: "getByTestId", args: ["device-row-remove"] }], fakeRecorder(), fakePostConditionRecorder(), matching);

    await expect(eir.click()).rejects.toThrow("Timeout 5000ms exceeded");

    expect(candidate.click).not.toHaveBeenCalled();
    expect(matching.annotate).toHaveBeenCalledWith(
      "eir-suggested",
      expect.stringContaining("device-row-remove") as unknown as string,
    );
  });
});

describe("heal mode — retry-once semantics", () => {
  it("heals: retries the matched candidate and returns its result when no post-condition was ever stored (no baseline)", async () => {
    vi.mocked(capturePulse).mockResolvedValue(null);
    const candidate = fakeCandidateLocator();
    const page = fakePage(candidate);
    const real = fakeOriginalLocator(page);
    const matching = fakeMatching(HEAL_MODE); // no stored post-condition passed -> lookup() returns undefined
    const eir = new EirLocator(real, [{ method: "getByTestId", args: ["device-row-remove"] }], fakeRecorder(), fakePostConditionRecorder(), matching);

    await expect(eir.click()).resolves.toBeUndefined();

    expect(candidate.click).toHaveBeenCalledTimes(1);
    expect(matching.annotate).toHaveBeenCalledWith(
      "eir-healed",
      expect.stringContaining("device-row-remove") as unknown as string,
    );
    // NOTE-004: no baseline ever existed for this selector -> a materially weaker trust signal, distinguished from "verified".
    expect(matching.policyLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ retryOutcome: { kind: "healed", verification: "skipped-no-baseline" } }),
    );
  });

  it("heals: a stored post-condition of \"none\" always passes verification, labeled skipped-none (NOTE-004)", async () => {
    const stored: PostCondition = { v: 1, kind: "none" };
    vi.mocked(capturePulse)
      .mockResolvedValueOnce(null) // #runImperative's unused pulseBefore
      .mockResolvedValueOnce({ route: "/dashboard/devices", elementCount: 50 }) // retry before
      .mockResolvedValueOnce({ route: "/dashboard/devices", elementCount: 50 }); // retry after — unchanged, matches "none"
    const candidate = fakeCandidateLocator();
    const page = fakePage(candidate);
    const real = fakeOriginalLocator(page);
    const matching = fakeMatching(HEAL_MODE, stored);
    const eir = new EirLocator(real, [{ method: "getByTestId", args: ["device-row-remove"] }], fakeRecorder(), fakePostConditionRecorder(), matching);

    await expect(eir.click()).resolves.toBeUndefined();

    expect(matching.policyLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ retryOutcome: { kind: "healed", verification: "skipped-none" } }),
    );
  });

  it("heals: a stored baseline exists but this retry's pulse couldn't be observed, labeled skipped-none (NOTE-004)", async () => {
    const stored: PostCondition = { v: 1, kind: "dom-count-change", sign: "decreased" };
    vi.mocked(capturePulse).mockResolvedValue(null); // pulses unobservable this retry, despite a real stored baseline
    const candidate = fakeCandidateLocator();
    const page = fakePage(candidate);
    const real = fakeOriginalLocator(page);
    const matching = fakeMatching(HEAL_MODE, stored);
    const eir = new EirLocator(real, [{ method: "getByTestId", args: ["device-row-remove"] }], fakeRecorder(), fakePostConditionRecorder(), matching);

    await expect(eir.click()).resolves.toBeUndefined();

    expect(matching.policyLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ retryOutcome: { kind: "healed", verification: "skipped-none" } }),
    );
  });

  it("heals: retry succeeds and the stored post-condition matches what was observed", async () => {
    const stored: PostCondition = { v: 1, kind: "dom-count-change", sign: "decreased" };
    vi.mocked(capturePulse)
      .mockResolvedValueOnce(null) // #runImperative's unused pulseBefore (original action never succeeds)
      .mockResolvedValueOnce({ route: "/dashboard/devices", elementCount: 50 }) // retry before
      .mockResolvedValueOnce({ route: "/dashboard/devices", elementCount: 49 }); // retry after — count decreased, matches stored
    const candidate = fakeCandidateLocator();
    const page = fakePage(candidate);
    const real = fakeOriginalLocator(page);
    const matching = fakeMatching(HEAL_MODE, stored);
    const eir = new EirLocator(real, [{ method: "getByTestId", args: ["device-row-remove"] }], fakeRecorder(), fakePostConditionRecorder(), matching);

    await expect(eir.click()).resolves.toBeUndefined();
    expect(matching.annotate).toHaveBeenCalledWith("eir-healed", expect.any(String) as unknown as string);
    // NOTE-004: a real stored post-condition, genuinely compared and matched -> "verified", not just "healed".
    expect(matching.policyLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ retryOutcome: { kind: "healed", verification: "verified" } }),
    );
  });

  it("rejects the heal (rethrows the ORIGINAL error) when the retry succeeds but the post-condition mismatches", async () => {
    const stored: PostCondition = { v: 1, kind: "dom-count-change", sign: "decreased" };
    vi.mocked(capturePulse)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ route: "/dashboard/devices", elementCount: 50 })
      .mockResolvedValueOnce({ route: "/dashboard/devices", elementCount: 51 }); // increased, not decreased — mismatch
    const candidate = fakeCandidateLocator();
    const page = fakePage(candidate);
    const real = fakeOriginalLocator(page);
    const matching = fakeMatching(HEAL_MODE, stored);
    const eir = new EirLocator(real, [{ method: "getByTestId", args: ["device-row-remove"] }], fakeRecorder(), fakePostConditionRecorder(), matching);

    await expect(eir.click()).rejects.toThrow("Timeout 5000ms exceeded");

    expect(candidate.click).toHaveBeenCalledTimes(1); // the retry really was attempted
    expect(matching.annotate).toHaveBeenCalledWith(
      "eir-heal-rejected",
      expect.any(String) as unknown as string,
    );
  });

  it("rethrows the ORIGINAL error (never the retry's own error) when the retry itself throws", async () => {
    vi.mocked(capturePulse).mockResolvedValue(null);
    const candidate = fakeCandidateLocator({
      click: vi.fn().mockRejectedValue(new Error("retry-specific failure, should never surface")),
    });
    const page = fakePage(candidate);
    const real = fakeOriginalLocator(page);
    const matching = fakeMatching(HEAL_MODE);
    const eir = new EirLocator(real, [{ method: "getByTestId", args: ["device-row-remove"] }], fakeRecorder(), fakePostConditionRecorder(), matching);

    await expect(eir.click()).rejects.toThrow("Timeout 5000ms exceeded");

    expect(matching.annotate).toHaveBeenCalledWith(
      "eir-heal-attempt-failed",
      expect.any(String) as unknown as string,
    );
  });

  it("never retries when confidence/margin fall short of the heal bar (fail-with-suggestion instead)", async () => {
    vi.mocked(attemptMatch).mockResolvedValue({ ...MATCHED, confidence: 0.5 });
    const candidate = fakeCandidateLocator();
    const page = fakePage(candidate);
    const real = fakeOriginalLocator(page);
    const matching = fakeMatching(HEAL_MODE);
    const eir = new EirLocator(real, [{ method: "getByTestId", args: ["device-row-remove"] }], fakeRecorder(), fakePostConditionRecorder(), matching);

    await expect(eir.click()).rejects.toThrow("Timeout 5000ms exceeded");

    expect(candidate.click).not.toHaveBeenCalled();
    expect(matching.annotate).toHaveBeenCalledWith("eir-suggested", expect.any(String) as unknown as string);
  });
});
