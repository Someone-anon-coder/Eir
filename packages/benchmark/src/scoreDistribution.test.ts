import { describe, expect, it } from "vitest";
import {
  computeConfidenceStats,
  renderScoreDistributionMarkdown,
  type ScoredAttempt,
  type ScoreDistributionResult,
} from "./scoreDistribution.js";

function attempt(overrides: Partial<ScoredAttempt> & Pick<ScoredAttempt, "confidence">): ScoredAttempt {
  return {
    mutationClass: "id-rename",
    targetId: "a target",
    margin: 0.1,
    ...overrides,
  };
}

describe("computeConfidenceStats", () => {
  it("returns null when there are no matched attempts", () => {
    expect(computeConfidenceStats([])).toBeNull();
  });

  it("computes min/max/mean/median for a simple set", () => {
    const stats = computeConfidenceStats([
      attempt({ confidence: 0.2 }),
      attempt({ confidence: 0.4 }),
      attempt({ confidence: 0.6 }),
      attempt({ confidence: 0.8 }),
    ]);

    expect(stats?.count).toBe(4);
    expect(stats?.min).toBe(0.2);
    expect(stats?.max).toBe(0.8);
    expect(stats?.mean).toBeCloseTo(0.5, 5);
  });

  it("buckets confidences into ten 0.1-wide histogram bins", () => {
    const stats = computeConfidenceStats([
      attempt({ confidence: 0.05 }), // bucket 0
      attempt({ confidence: 0.15 }), // bucket 1
      attempt({ confidence: 0.95 }), // bucket 9
      attempt({ confidence: 1.0 }), // bucket 9 (edge case: clamped, not overflowed)
    ]);

    expect(stats?.histogram[0]).toBe(1);
    expect(stats?.histogram[1]).toBe(1);
    expect(stats?.histogram[9]).toBe(2);
    expect(stats?.histogram.reduce((a, b) => a + b, 0)).toBe(4);
  });

  it("identifies matched attempts below the current 0.3 threshold, sorted ascending", () => {
    const stats = computeConfidenceStats([
      attempt({ confidence: 0.5, targetId: "high" }),
      attempt({ confidence: 0.1, targetId: "low" }),
      attempt({ confidence: 0.25, targetId: "mid-low" }),
    ]);

    expect(stats?.belowCurrentThreshold.map((m) => m.targetId)).toEqual(["low", "mid-low"]);
  });

  it("reports an empty belowCurrentThreshold list when every attempt clears 0.3", () => {
    const stats = computeConfidenceStats([attempt({ confidence: 0.5 }), attempt({ confidence: 0.75 })]);

    expect(stats?.belowCurrentThreshold).toEqual([]);
  });
});

describe("renderScoreDistributionMarkdown", () => {
  const base: ScoreDistributionResult = {
    seed: 42,
    generatedAt: "2026-07-17T00:00:00.000Z",
    matched: [],
    totalProbes: 64,
    passedProbes: 0,
    failedNoAttempt: 0,
    noCandidates: 0,
    rejected: 0,
  };

  it("states plainly when no matched attempts exist to analyze", () => {
    const markdown = renderScoreDistributionMarkdown(base);
    expect(markdown).toContain("No `matched` attempts were recorded");
  });

  it("renders the probe census counts", () => {
    const markdown = renderScoreDistributionMarkdown({
      ...base,
      matched: [attempt({ confidence: 0.8 })],
    });
    expect(markdown).toContain("| 64 | 0 | 0 | 0 | 0 | 1 |");
  });

  it("states honestly when no attempt scored below the current threshold", () => {
    const markdown = renderScoreDistributionMarkdown({
      ...base,
      matched: [attempt({ confidence: 0.8 }), attempt({ confidence: 0.5 })],
    });
    expect(markdown).toContain("None. Every real `matched` attempt this run scored at or above");
  });

  it("lists every below-threshold attempt with its class, target, confidence, and margin", () => {
    const markdown = renderScoreDistributionMarkdown({
      ...base,
      matched: [attempt({ confidence: 0.15, targetId: "weak-one", margin: 0.02 })],
    });
    expect(markdown).toContain("weak-one");
    expect(markdown).toContain("0.1500");
    expect(markdown).toContain("0.0200");
  });
});
