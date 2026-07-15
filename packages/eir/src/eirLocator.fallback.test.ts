import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Locator, Page } from "@playwright/test";

vi.mock("./matching/matcher.js", () => ({ attemptMatch: vi.fn() }));
vi.mock("./capture/captureFingerprint.js", () => ({ captureFingerprint: vi.fn().mockResolvedValue(null) }));
vi.mock("./capture/capturePulse.js", () => ({ capturePulse: vi.fn().mockResolvedValue(null) }));

import { EirLocator } from "./eirLocator.js";
import type { FallbackRunner } from "./fallback/runFallback.js";
import type { FallbackOutcome } from "./fallback/verdict.js";
import type { MatchingContext } from "./matching/context.js";
import { attemptMatch, type MatchAttempt } from "./matching/matcher.js";
import type { PolicyEvent } from "./policy/policyLog.js";
import type { EirMode } from "./policy/eirMode.js";
import type { FingerprintRecorder } from "./store/fingerprintStore.js";
import type { PostConditionRecorder } from "./store/postConditionStore.js";

/**
 * The suggestion-cap, tested at the orchestration level (Blueprint P4
 * applied to AI): whatever the fallback answers, the test still fails
 * with the ORIGINAL error, nothing is retried, and the verdict only ever
 * lands on the recorded policy event. Plus the trigger's wiring: the
 * runner is consulted for exactly the formally-uncertain shapes and
 * nothing else — mode-independent in both directions.
 */

const FEATURES = {
  tag: "button",
  attrs: { "data-testid": "wizard-next" },
  text: "Next",
  label: null,
  ancestors: [],
  siblingIndex: 0,
  siblingCount: 2,
  bbox: { x: 0, y: 0, w: 64, h: 32 },
} as const;

function matched(confidence: number, margin: number): Extract<MatchAttempt, { kind: "matched" }> {
  return {
    kind: "matched",
    fingerprint: { v: 1, ...FEATURES },
    candidateCount: 2,
    winner: FEATURES,
    breakdown: {
      attrOverlap: 0.5,
      textSimilarity: 0.5,
      labelMatch: 0,
      ancestorChain: 0.5,
      siblingPosition: 0.5,
      bboxProximity: 0.5,
    },
    confidence,
    margin,
    suggestion: null,
    winnerLocator: { selector: "button", domIndex: 0 },
    shortlist: [
      { features: FEATURES, breakdown: { attrOverlap: 0.5, textSimilarity: 0.5, labelMatch: 0, ancestorChain: 0.5, siblingPosition: 0.5, bboxProximity: 0.5 }, total: confidence, selector: "button", domIndex: 0 },
      { features: FEATURES, breakdown: { attrOverlap: 0.4, textSimilarity: 0.4, labelMatch: 0, ancestorChain: 0.4, siblingPosition: 0.4, bboxProximity: 0.4 }, total: confidence - margin, selector: "button", domIndex: 1 },
    ],
  };
}

const HEAL_MODE: EirMode = { mode: "heal", healThreshold: 0.7, suggestThreshold: 0.3 };
const SUGGEST_ONLY: EirMode = { mode: "suggest-only" };

const CONTRADICTING_OUTCOME: FallbackOutcome = {
  provider: "null",
  verdict: "contradicted",
  detail: "<button> — button >> nth=1: the other one",
  meta: null,
};

function fakeRunner(outcome: FallbackOutcome = CONTRADICTING_OUTCOME): FallbackRunner & { run: ReturnType<typeof vi.fn> } {
  return { run: vi.fn().mockResolvedValue(outcome) };
}

function fakeCandidateLocator(): Locator {
  return {
    click: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(Buffer.from("png")),
  } as unknown as Locator;
}

function fakePage(candidateLocator: Locator): Page {
  return {
    url: () => "http://localhost:5173/dashboard/devices",
    evaluate: vi.fn().mockResolvedValue("complete"),
    locator: vi.fn().mockReturnValue({ nth: vi.fn().mockReturnValue(candidateLocator) }),
  } as unknown as Page;
}

function fakeOriginalLocator(page: Page): Locator {
  return {
    toString: () => "getByTestId('wizard-next')",
    page: () => page,
    click: vi.fn().mockRejectedValue(new Error("Timeout 5000ms exceeded waiting for locator")),
  } as unknown as Locator;
}

function fakeRecorder(): FingerprintRecorder {
  return { record: vi.fn(), trackPending: vi.fn() };
}

function fakePostConditionRecorder(): PostConditionRecorder {
  return { record: vi.fn(), trackPending: vi.fn() };
}

function fakeMatching(mode: EirMode, fallback: FallbackRunner | null): MatchingContext {
  return {
    reader: { lookup: () => undefined },
    log: { record: vi.fn() },
    postConditionReader: { lookup: () => undefined },
    mode,
    policyLog: { record: vi.fn() },
    annotate: vi.fn(),
    fallback,
  };
}

function makeLocator(matching: MatchingContext): { eir: EirLocator; candidate: Locator } {
  const candidate = fakeCandidateLocator();
  const page = fakePage(candidate);
  const real = fakeOriginalLocator(page);
  const eir = new EirLocator(real, [{ method: "getByTestId", args: ["wizard-next"] }], fakeRecorder(), fakePostConditionRecorder(), matching);
  return { eir, candidate };
}

function recordedEvent(matching: MatchingContext): PolicyEvent {
  const event: unknown = vi.mocked(matching.policyLog.record).mock.calls[0]?.[0];
  return event as PolicyEvent; // test-only: reading back the exact shape recorded by the code under test
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fallback wiring — fires on formal uncertainty only", () => {
  beforeEach(() => {
    vi.mocked(attemptMatch).mockResolvedValue(matched(0.5, 0.01));
  });

  it("uncertain match + runner → runner consulted once, verdict lands on the policy event, original error still thrown", async () => {
    const runner = fakeRunner();
    const matching = fakeMatching(SUGGEST_ONLY, runner);
    const { eir, candidate } = makeLocator(matching);

    await expect(eir.click()).rejects.toThrow("Timeout 5000ms exceeded");

    expect(runner.run).toHaveBeenCalledTimes(1);
    expect(runner.run).toHaveBeenCalledWith(expect.objectContaining({ kind: "matched" }), "fail-with-suggestion");
    const event = recordedEvent(matching);
    expect(event.kind).toBe("heal-attempt");
    if (event.kind === "heal-attempt") expect(event.fallback).toEqual(CONTRADICTING_OUTCOME);
    // The cap: a contradicting verdict retries nothing.
    expect(candidate.click).not.toHaveBeenCalled();
  });

  it("no runner configured (the shipped default) → event records fallback: null", async () => {
    const matching = fakeMatching(SUGGEST_ONLY, null);
    const { eir } = makeLocator(matching);

    await expect(eir.click()).rejects.toThrow();
    const event = recordedEvent(matching);
    if (event.kind === "heal-attempt") expect(event.fallback).toBeNull();
  });

  it("a runner that rejects degrades to fallback: null — never affects the test's own failure", async () => {
    const runner: FallbackRunner = { run: vi.fn().mockRejectedValue(new Error("provider exploded")) };
    const matching = fakeMatching(SUGGEST_ONLY, runner);
    const { eir } = makeLocator(matching);

    await expect(eir.click()).rejects.toThrow("Timeout 5000ms exceeded");
    const event = recordedEvent(matching);
    if (event.kind === "heal-attempt") expect(event.fallback).toBeNull();
  });
});

describe("fallback wiring — never fires above the predicate", () => {
  it("confident match in suggest-only mode (fail-with-suggestion, but not uncertainty) → runner never consulted", async () => {
    vi.mocked(attemptMatch).mockResolvedValue(matched(0.95, 0.4));
    const runner = fakeRunner();
    const matching = fakeMatching(SUGGEST_ONLY, runner);
    const { eir } = makeLocator(matching);

    await expect(eir.click()).rejects.toThrow();
    expect(runner.run).not.toHaveBeenCalled();
    const event = recordedEvent(matching);
    if (event.kind === "heal-attempt") expect(event.fallback).toBeNull();
  });

  it("heal-qualified match in heal mode → heal branch records fallback: null, runner never consulted", async () => {
    vi.mocked(attemptMatch).mockResolvedValue(matched(0.95, 0.4));
    const runner = fakeRunner();
    const matching = fakeMatching(HEAL_MODE, runner);
    const { eir, candidate } = makeLocator(matching);

    await eir.click(); // heals and continues

    expect(candidate.click).toHaveBeenCalledTimes(1);
    expect(runner.run).not.toHaveBeenCalled();
    const event = recordedEvent(matching);
    expect(event.kind).toBe("heal-attempt");
    if (event.kind === "heal-attempt") {
      expect(event.action.kind).toBe("heal-and-continue");
      expect(event.fallback).toBeNull();
    }
  });

  it.each([
    ["rejected", { kind: "rejected", reason: "no-fingerprint", detail: "" } satisfies MatchAttempt],
    ["no-candidates", { kind: "no-candidates", fingerprint: { v: 1, ...FEATURES } } satisfies MatchAttempt],
  ])("%s attempt → no shortlist exists, runner never consulted", async (_desc, attempt) => {
    vi.mocked(attemptMatch).mockResolvedValue(attempt);
    const runner = fakeRunner();
    const matching = fakeMatching(SUGGEST_ONLY, runner);
    const { eir } = makeLocator(matching);

    await expect(eir.click()).rejects.toThrow();
    expect(runner.run).not.toHaveBeenCalled();
  });
});
