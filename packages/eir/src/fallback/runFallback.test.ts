import { afterEach, describe, expect, it, vi } from "vitest";
import type { Fingerprint } from "../fingerprint.js";
import { NullProvider } from "./nullProvider.js";
import {
  ProviderFallbackRunner,
  buildFallbackRunner,
  contextFromAttempt,
  mapVerdict,
} from "./runFallback.js";
import type { UncertainMatch } from "./trigger.js";
import type { FallbackCandidate, FallbackContext } from "./verdict.js";

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

const FINGERPRINT: Fingerprint = { v: 1, ...FEATURES };

const BREAKDOWN = {
  attrOverlap: 0.5,
  textSimilarity: 0.5,
  labelMatch: 0,
  ancestorChain: 0.5,
  siblingPosition: 0.5,
  bboxProximity: 0.5,
} as const;

function candidate(total: number, domIndex: number): FallbackCandidate {
  return { features: FEATURES, breakdown: BREAKDOWN, total, selector: "button", domIndex };
}

const CTX: FallbackContext = {
  fingerprint: FINGERPRINT,
  candidates: [candidate(0.6, 0), candidate(0.55, 1), candidate(0.2, 2)],
  confidence: 0.6,
  margin: 0.05,
};

describe("mapVerdict — the pure verdict→outcome mapping", () => {
  it("chose(0) = the heuristic winner → endorsed", () => {
    const outcome = mapVerdict("null", CTX, { kind: "chose", candidateIndex: 0, reasoning: "same testid" }, null, "fail-with-suggestion");
    expect(outcome.verdict).toBe("endorsed");
    expect(outcome.provider).toBe("null");
  });

  it("chose(non-winner) on a row with a heuristic suggestion → contradicted", () => {
    const outcome = mapVerdict("null", CTX, { kind: "chose", candidateIndex: 1, reasoning: "text matches better" }, null, "fail-with-suggestion");
    expect(outcome.verdict).toBe("contradicted");
    expect(outcome.detail).toContain("nth=1");
  });

  it("chose(non-winner) on a below-floor row → alternative", () => {
    const outcome = mapVerdict("null", CTX, { kind: "chose", candidateIndex: 2, reasoning: "only plausible one" }, null, "fail-normally");
    expect(outcome.verdict).toBe("alternative");
  });

  it("an out-of-range index — the model inventing a candidate — is a no-verdict, never a guess", () => {
    const outcome = mapVerdict("null", CTX, { kind: "chose", candidateIndex: 7, reasoning: "hallucinated" }, null, "fail-with-suggestion");
    expect(outcome.verdict).toBe("no-verdict");
    expect(outcome.detail).toContain("candidate-index-out-of-range:7");
  });

  it("none-of-them and no-verdict pass through with their reasons", () => {
    expect(mapVerdict("null", CTX, { kind: "none-of-them", reasoning: "all differ" }, null, "fail-normally").verdict).toBe("none-of-them");
    expect(mapVerdict("null", CTX, { kind: "no-verdict", reason: "timeout" }, null, "fail-normally")).toMatchObject({ verdict: "no-verdict", detail: "timeout" });
  });

  it("clips very long reasoning so a rambling model cannot bloat the report", () => {
    const outcome = mapVerdict("null", CTX, { kind: "chose", candidateIndex: 0, reasoning: "x".repeat(1000) }, null, "fail-with-suggestion");
    expect((outcome.detail ?? "").length).toBeLessThan(500);
  });
});

describe("ProviderFallbackRunner", () => {
  const ATTEMPT: UncertainMatch = {
    kind: "matched",
    fingerprint: FINGERPRINT,
    candidateCount: 3,
    winner: FEATURES,
    breakdown: BREAKDOWN,
    confidence: 0.6,
    margin: 0.05,
    suggestion: null,
    winnerLocator: { selector: "button", domIndex: 0 },
    shortlist: CTX.candidates,
  };

  it("hands the provider exactly the fingerprint + shortlist (never more)", async () => {
    const provider = new NullProvider([{ kind: "chose", candidateIndex: 0, reasoning: "ok" }]);
    const runner = new ProviderFallbackRunner(provider);
    const outcome = await runner.run(ATTEMPT, "fail-with-suggestion");

    expect(outcome.verdict).toBe("endorsed");
    expect(provider.judged).toEqual([contextFromAttempt(ATTEMPT)]);
    expect(provider.judged[0]?.candidates).toBe(ATTEMPT.shortlist);
  });

  it("a scripted-out NullProvider degrades to no-verdict, never throws", async () => {
    const runner = new ProviderFallbackRunner(new NullProvider());
    const outcome = await runner.run(ATTEMPT, "fail-normally");
    expect(outcome).toMatchObject({ provider: "null", verdict: "no-verdict", detail: "null-provider" });
  });
});

describe("buildFallbackRunner — off by default, clean no-key skip", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("no fallback config at all → null (the shipped default)", () => {
    expect(buildFallbackRunner(undefined, {})).toBeNull();
  });

  it("enabled: false → null even with a key present", () => {
    expect(buildFallbackRunner({ enabled: false }, { GEMINI_API_KEY: "k" })).toBeNull();
  });

  it("enabled but no key in env → null with a clear one-time warning, not a crash", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(buildFallbackRunner({ enabled: true }, {})).toBeNull();
    expect(buildFallbackRunner({ enabled: true }, {})).toBeNull();
    const messages = warn.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes("GEMINI_API_KEY is not set"))).toBe(true);
    expect(messages.length).toBe(1);
  });

  it("enabled + key present → a real runner (and the key itself never appears in any warning)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const runner = buildFallbackRunner({ enabled: true, apiKeyEnv: "CUSTOM_KEY_ENV" }, { CUSTOM_KEY_ENV: "super-secret-value" });
    expect(runner).not.toBeNull();
    expect(warn.mock.calls.flat().join(" ")).not.toContain("super-secret-value");
  });
});
