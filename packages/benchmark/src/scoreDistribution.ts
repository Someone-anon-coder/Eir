import { buildMutationRun } from "./groundTruth.js";
import { startDevServer } from "./devServer.js";
import { runProbeSuite, type ProbeTestResult } from "./probeRunner.js";
import { MUTATION_CLASSES, type MutationClass } from "./mutationClasses.js";

/**
 * B1 (1.0.0 closure): `DEFAULT_SUGGEST_THRESHOLD` (0.3) has shipped as an
 * honestly-labeled *estimate* since Phase 6 — Q-001 records that Phase
 * 5's own tuning loop never produced a genuinely low-confidence `matched`
 * result to calibrate against. This module runs every mutated probe
 * across all 8 classes and records the raw confidence/margin of every
 * `matched` attempt — heuristics-only (`suggest-only` mode, `runProbeSuite`'s
 * default), the same measurement lens the standing baseline table already
 * uses — so the threshold decision can be anchored to real data, or
 * honestly kept as an estimate if the data doesn't support anchoring it.
 */
export interface ScoredAttempt {
  readonly mutationClass: MutationClass;
  readonly targetId: string;
  readonly confidence: number;
  readonly margin: number;
}

export interface ScoreDistributionResult {
  readonly seed: number;
  readonly generatedAt: string;
  readonly matched: readonly ScoredAttempt[];
  readonly totalProbes: number;
  /** Mutation didn't break this target (classifyProbeRun's "mutation-ineffective") — no failure, so Eir's matcher never ran. */
  readonly passedProbes: number;
  /** Probe failed, but Eir recorded no match attempt at all for it (a real "missed," zero signal). */
  readonly failedNoAttempt: number;
  readonly noCandidates: number;
  readonly rejected: number;
}

export async function gatherScoreDistribution(seed: number): Promise<ScoreDistributionResult> {
  const matched: ScoredAttempt[] = [];
  let totalProbes = 0;
  let passedProbes = 0;
  let failedNoAttempt = 0;
  let noCandidates = 0;
  let rejected = 0;

  for (const mutationClass of MUTATION_CLASSES) {
    const run = buildMutationRun(mutationClass, seed);
    const overrideJson = JSON.stringify(run.overridePayload);

    const server = await startDevServer(overrideJson);
    let results: readonly ProbeTestResult[];
    try {
      results = await runProbeSuite(mutationClass, seed);
    } finally {
      await server.stop();
    }

    for (const result of results) {
      totalProbes++;
      if (result.passed) {
        passedProbes++;
        continue;
      }
      const attempt = result.matchAttempt;
      if (attempt === undefined) {
        failedNoAttempt++;
        continue;
      }
      const { result: matchResult } = attempt;
      if (matchResult.kind === "no-candidates") {
        noCandidates++;
      } else if (matchResult.kind === "rejected") {
        rejected++;
      } else {
        matched.push({
          mutationClass,
          targetId: result.targetId,
          confidence: matchResult.confidence,
          margin: matchResult.margin,
        });
      }
    }
  }

  return {
    seed,
    generatedAt: new Date().toISOString(),
    matched,
    totalProbes,
    passedProbes,
    failedNoAttempt,
    noCandidates,
    rejected,
  };
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const index = Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)));
  return sorted[index] ?? NaN;
}

export interface ConfidenceStats {
  readonly count: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly median: number;
  /** Ten buckets, width 0.1: histogram[0] = [0.0, 0.1), ..., histogram[9] = [0.9, 1.0]. */
  readonly histogram: readonly number[];
  readonly belowCurrentThreshold: readonly ScoredAttempt[];
}

export function computeConfidenceStats(matched: readonly ScoredAttempt[]): ConfidenceStats | null {
  if (matched.length === 0) return null;

  const confidences = matched.map((m) => m.confidence).sort((a, b) => a - b);
  const histogram = new Array<number>(10).fill(0);
  for (const c of confidences) {
    const bucket = Math.min(9, Math.floor(c * 10));
    histogram[bucket] = (histogram[bucket] ?? 0) + 1;
  }

  const sum = confidences.reduce((total, c) => total + c, 0);
  const belowCurrentThreshold = matched
    .filter((m) => m.confidence < 0.3)
    .sort((a, b) => a.confidence - b.confidence);

  return {
    count: confidences.length,
    min: confidences[0] ?? NaN,
    max: confidences[confidences.length - 1] ?? NaN,
    mean: sum / confidences.length,
    median: percentile(confidences, 0.5),
    histogram,
    belowCurrentThreshold,
  };
}

export function renderScoreDistributionMarkdown(result: ScoreDistributionResult): string {
  const stats = computeConfidenceStats(result.matched);
  const lines: string[] = [
    `# suggestThreshold evidence — seed ${String(result.seed)}`,
    "",
    `Generated ${result.generatedAt}. Heuristics-only, \`suggest-only\` mode (the standing baseline's own measurement lens) across all 8 mutation classes.`,
    "",
    "## Probe census",
    "",
    `| Total probes | Passed (mutation-ineffective) | Failed, no attempt | No-candidates | Rejected | Matched |`,
    `|---:|---:|---:|---:|---:|---:|`,
    `| ${String(result.totalProbes)} | ${String(result.passedProbes)} | ${String(result.failedNoAttempt)} | ${String(result.noCandidates)} | ${String(result.rejected)} | ${String(result.matched.length)} |`,
    "",
  ];

  if (stats === null) {
    lines.push(
      "No `matched` attempts were recorded this run — no confidence distribution to analyze.",
      "",
    );
    return lines.join("\n");
  }

  lines.push(
    "## Matched-attempt confidence distribution",
    "",
    `count=${String(stats.count)}, min=${stats.min.toFixed(4)}, max=${stats.max.toFixed(4)}, mean=${stats.mean.toFixed(4)}, median=${stats.median.toFixed(4)}`,
    "",
    "| Bucket | Count |",
    "|---|---:|",
    ...stats.histogram.map(
      (count, i) => `| [${(i / 10).toFixed(1)}, ${i === 9 ? "1.0]" : `${((i + 1) / 10).toFixed(1)})`} | ${String(count)} |`,
    ),
    "",
    `## Matched attempts below the current DEFAULT_SUGGEST_THRESHOLD (0.3)`,
    "",
  );

  if (stats.belowCurrentThreshold.length === 0) {
    lines.push(
      "None. Every real `matched` attempt this run scored at or above the current 0.3 floor — no genuinely low-confidence match exists in this data to anchor a lower (or higher) number against.",
      "",
    );
  } else {
    lines.push(
      "| Class | Target | Confidence | Margin |",
      "|---|---|---:|---:|",
      ...stats.belowCurrentThreshold.map(
        (m) => `| ${m.mutationClass} | ${m.targetId} | ${m.confidence.toFixed(4)} | ${m.margin.toFixed(4)} |`,
      ),
      "",
    );
  }

  lines.push(
    "## All matched attempts (raw)",
    "",
    "| Class | Target | Confidence | Margin |",
    "|---|---|---:|---:|",
    ...[...result.matched]
      .sort((a, b) => a.confidence - b.confidence)
      .map((m) => `| ${m.mutationClass} | ${m.targetId} | ${m.confidence.toFixed(4)} | ${m.margin.toFixed(4)} |`),
    "",
  );

  return lines.join("\n");
}
