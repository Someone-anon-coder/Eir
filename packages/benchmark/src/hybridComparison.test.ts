import { describe, expect, it } from "vitest";
import type { PolicyFallbackInfo } from "./policyLog.js";
import { renderHybridComparisonMarkdown, summarizeClass, type HybridClassResult } from "./hybridComparison.js";

function invocation(targetId: string, fallback: Partial<PolicyFallbackInfo> & Pick<PolicyFallbackInfo, "verdict">) {
  return {
    targetId,
    fallback: {
      provider: "gemini",
      detail: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      ...fallback,
    },
  };
}

describe("summarizeClass — pure aggregation", () => {
  it("zero invocations → null agreement/latency rates, zero cost, not NaN", () => {
    const result: HybridClassResult = { mutationClass: "tag-swap", seed: 42, invocations: [] };
    const summary = summarizeClass(result);
    expect(summary).toMatchObject({
      invocationCount: 0,
      agreementRate: null,
      avgLatencyMs: null,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      estimatedCostUsd: 0,
    });
  });

  it("counts every verdict kind independently", () => {
    const result: HybridClassResult = {
      mutationClass: "class-shuffle",
      seed: 42,
      invocations: [
        invocation("a", { verdict: "endorsed", latencyMs: 1000, inputTokens: 800, outputTokens: 60 }),
        invocation("b", { verdict: "contradicted", latencyMs: 2000 }),
        invocation("c", { verdict: "alternative" }),
        invocation("d", { verdict: "none-of-them" }),
        invocation("e", { verdict: "no-verdict", detail: "http-429" }),
      ],
    };
    const summary = summarizeClass(result);
    expect(summary.invocationCount).toBe(5);
    expect(summary).toMatchObject({ endorsed: 1, contradicted: 1, alternative: 1, noneOfThem: 1, noVerdict: 1 });
    expect(summary.agreementRate).toBeCloseTo(1 / 5);
  });

  it("latency averages only over invocations that reported latency (a no-verdict from a total network failure has none)", () => {
    const result: HybridClassResult = {
      mutationClass: "near-duplicate-sibling-swap",
      seed: 42,
      invocations: [
        invocation("a", { verdict: "endorsed", latencyMs: 1000 }),
        invocation("b", { verdict: "endorsed", latencyMs: 2000 }),
        invocation("c", { verdict: "no-verdict" }), // latencyMs: null
      ],
    };
    expect(summarizeClass(result).avgLatencyMs).toBeCloseTo(1500);
  });

  it("tokens sum only over invocations that reported them; cost is the measured token-weighted price", () => {
    const result: HybridClassResult = {
      mutationClass: "id-rename",
      seed: 42,
      invocations: [
        invocation("a", { verdict: "endorsed", inputTokens: 1_000_000, outputTokens: 1_000_000 }),
        invocation("b", { verdict: "no-verdict" }), // no tokens
      ],
    };
    const summary = summarizeClass(result);
    expect(summary.totalInputTokens).toBe(1_000_000);
    expect(summary.totalOutputTokens).toBe(1_000_000);
    // $0.10/1M in + $0.40/1M out, at exactly 1M tokens each.
    expect(summary.estimatedCostUsd).toBeCloseTo(0.5, 5);
  });
});

describe("renderHybridComparisonMarkdown", () => {
  it("renders a dash for classes with zero invocations rather than 0% or NaN", () => {
    const results: HybridClassResult[] = [{ mutationClass: "sibling-reorder", seed: 42, invocations: [] }];
    const markdown = renderHybridComparisonMarkdown(results);
    expect(markdown).toContain("| sibling-reorder | 0 | 0 | 0 | 0 | 0 | 0 | — | — | 0/0 |");
  });

  it("the total line's agreement percentage is computed over the true grand total, not summed per-class percentages", () => {
    const results: HybridClassResult[] = [
      { mutationClass: "id-rename", seed: 42, invocations: [invocation("a", { verdict: "endorsed" })] },
      {
        mutationClass: "text-change",
        seed: 42,
        invocations: [invocation("b", { verdict: "endorsed" }), invocation("c", { verdict: "no-verdict" })],
      },
    ];
    const markdown = renderHybridComparisonMarkdown(results);
    // 2 endorsed of 3 total invocations = 66.7%, not an average of 100% and 50%.
    expect(markdown).toContain("**Total: 3 invocations, 2 endorsed (66.7% agreement)");
  });
});
