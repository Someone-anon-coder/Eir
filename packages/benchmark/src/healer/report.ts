import {
  aggregateToolClass,
  complementarityMatrix,
  costStats,
  eirRepeatIdentical,
  targetStabilities,
  type CostStats,
  type MatrixCell,
  type TargetStability,
  type ToolClassAggregate,
} from "./aggregate.js";
import { REPORT_OUTCOMES } from "./reporting.js";
import type { RunRecord } from "./runRecord.js";
import { applyStrictRule, type StrictRow } from "./strict.js";
import { HEALER_CLASSES } from "./specDraft.js";

export interface ReportMeta {
  readonly generatedAt: string;
  readonly playwrightVersion: string;
  readonly claudeCodeVersions: readonly string[];
  readonly modelIds: readonly string[];
  readonly healerAgentSha256: string;
  readonly seed: number;
  readonly healerRunsPerTarget: number;
  /** class -> targets excluded as mutation-ineffective (from each class's proof.json). */
  readonly mutationIneffective: Readonly<Record<string, readonly string[]>>;
  /** class -> targets proven effective. */
  readonly effectiveTargets: Readonly<Record<string, number>>;
}

export interface HealerReport {
  readonly meta: ReportMeta;
  readonly perClass: readonly ToolClassAggregate[];
  readonly overall: readonly ToolClassAggregate[];
  readonly cost: CostStats;
  readonly stability: readonly TargetStability[];
  readonly matrix: readonly MatrixCell[];
  readonly eirRepeat: { readonly compared: number; readonly identical: number };
  /**
   * Strict is the primary reading for path-attributed targets (class-shuffle):
   * a run counts as `healed-correct` only if the trace shows Playwright resolved
   * the target container itself. The lenient reading (the first judge's
   * marked-ancestor-path rule) is reported beside it. The per-run records below
   * are the judge's originals and are not changed.
   */
  readonly strictRule: {
    readonly description: string;
    readonly rows: readonly StrictRow[];
    /** Lenient vs strict healed-correct per class and overall, for every row where they differ. */
    readonly lenientVsStrict: readonly LenientVsStrict[];
  };
  readonly runs: readonly RunRecord[];
}

export interface LenientVsStrict {
  readonly tool: string;
  readonly mutationClass: string;
  readonly runs: number;
  readonly strictCorrect: number;
  readonly lenientCorrect: number;
}

const STRICT_DESCRIPTION =
  "For class-shuffle (judged by marked-ancestor path), a `healed-correct` run counts as correct (strict, primary) only if the Playwright trace shows the element it resolved was the target container itself; otherwise it is `correct-path-only`, which the lenient reading still counts as correct.";

export function buildReport(
  records: readonly RunRecord[],
  meta: ReportMeta,
  strictRows: readonly StrictRow[] = [],
): HealerReport {
  const reporting = applyStrictRule(records, strictRows);
  const classes = HEALER_CLASSES.filter((c) => records.some((r) => r.mutationClass === c));
  const perClass = classes.flatMap((c) =>
    (["healer", "eir"] as const).map((tool) => aggregateToolClass(reporting, tool, c)),
  );
  const overall = (["healer", "eir"] as const).map((tool) => {
    const agg = aggregateToolClass(
      reporting.map((r) => ({ ...r, mutationClass: "all" })),
      tool,
      "all",
    );
    return agg;
  });
  return {
    meta,
    perClass,
    overall,
    cost: costStats(reporting),
    stability: targetStabilities(reporting),
    matrix: complementarityMatrix(reporting),
    eirRepeat: eirRepeatIdentical(reporting),
    strictRule: {
      description: STRICT_DESCRIPTION,
      rows: strictRows,
      lenientVsStrict: [...perClass, ...overall]
        .filter(
          (a) =>
            a.counts["correct-path-only"] > 0 ||
            a.mutationClass === "class-shuffle" ||
            a.mutationClass === "all",
        )
        .map((a) => ({
          tool: a.tool,
          mutationClass: a.mutationClass,
          runs: a.runs,
          strictCorrect: a.counts["healed-correct"],
          lenientCorrect: a.counts["healed-correct"] + a.counts["correct-path-only"],
        })),
    },
    runs: records,
  };
}

function rejudgedSection(runs: readonly RunRecord[]): string[] {
  const changed = runs.filter((r) => r.previousOutcome !== undefined || r.adjudicated);
  if (changed.length === 0) return ["No run was re-judged or adjudicated."];
  const rows = [
    "Runs whose outcome a later judge version changed, or that carry a recorded human verdict. `previous` is what the first judge said.",
    "",
    "| Class | Target | Run | Previous | Now | Rule | Adjudicated |",
    "| --- | --- | ---: | --- | --- | --- | --- |",
  ];
  for (const r of changed) {
    const adj = r.adjudicated
      ? `yes, by ${r.adjudicatedBy ?? "?"} (${r.adjudicationVerdict ?? r.outcome}: ${r.adjudicationReason ?? ""})`
      : "no";
    rows.push(
      `| ${r.mutationClass} | ${r.targetId} | ${r.run} | ${r.previousOutcome ?? "(unchanged)"} | ${r.outcome} | ${r.rejudgedBy ?? "-"} | ${adj} |`,
    );
  }
  return rows;
}

const pct = (n: number, d: number): string => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}%`);
const usd = (n: number | undefined): string => (n === undefined ? "n/a" : `$${n.toFixed(4)}`);
const secs = (ms: number | undefined): string =>
  ms === undefined ? "n/a" : `${(ms / 1000).toFixed(1)}s`;

/**
 * `healed-correct` here is the strict reading (primary); the lenient reading
 * (strict plus the path-only credit) sits in the next column, and the path-only
 * runs are listed as their own column so every row still sums to 100%.
 */
function outcomeTable(rows: readonly ToolClassAggregate[]): string[] {
  const others = REPORT_OUTCOMES.filter(
    (o) => o !== "healed-correct" && o !== "correct-path-only" && rows.some((r) => r.counts[o] > 0),
  );
  const head = [
    "Class",
    "Tool",
    "Runs",
    "healed-correct (strict, primary)",
    "healed-correct (lenient)",
    "path-only credit (lenient only)",
    ...others,
    "infra-error (excluded)",
  ];
  const lines = [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`];
  for (const r of rows) {
    const strict = r.counts["healed-correct"];
    const pathOnly = r.counts["correct-path-only"];
    const cells = others.map((o) => `${pct(r.counts[o], r.runs)} (${r.counts[o]})`);
    lines.push(
      `| ${r.mutationClass} | ${r.tool} | ${r.runs} | ${pct(strict, r.runs)} (${strict}) | ${pct(strict + pathOnly, r.runs)} (${strict + pathOnly}) | ${pct(pathOnly, r.runs)} (${pathOnly}) | ${cells.join(" | ")} | ${r.infraErrors} |`,
    );
  }
  return lines;
}

function strictSection(report: HealerReport): string[] {
  const rows = [
    report.strictRule.description,
    "",
    "| Tool | Class | Runs | healed-correct, strict (primary) | healed-correct, lenient |",
    "| --- | --- | ---: | ---: | ---: |",
    ...report.strictRule.lenientVsStrict.map(
      (a) =>
        `| ${a.tool} | ${a.mutationClass} | ${a.runs} | ${pct(a.strictCorrect, a.runs)} (${a.strictCorrect}) | ${pct(a.lenientCorrect, a.runs)} (${a.lenientCorrect}) |`,
    ),
    "",
  ];
  const credited = report.strictRule.rows.filter((r) => !r.resolvedIsTarget);
  if (credited.length > 0) {
    rows.push(
      "Runs credited by path only (the trace shows a different element was resolved):",
      "",
      "| Tool | Target | Run | Playwright resolved |",
      "| --- | --- | ---: | --- |",
    );
    for (const r of credited) rows.push(`| ${r.tool} | ${r.targetId} | ${r.run} | ${r.resolved} |`);
  } else {
    rows.push("No run was credited by path only.");
  }
  return rows;
}

/** Counts sit beside every percentage; nothing here is computed outside the run records. */
export function renderMarkdown(report: HealerReport): string {
  const m = report.meta;
  const out: string[] = [
    "# Healer comparison: playwright-eir vs Playwright's healer agent",
    "",
    "Generated by `pnpm --filter benchmark bench:healer-report` from the per-run records. Do not edit by hand.",
    "",
    "| | |",
    "| --- | --- |",
    `| Generated | ${m.generatedAt} |`,
    `| Playwright | ${m.playwrightVersion} |`,
    `| Claude Code CLI | ${m.claudeCodeVersions.join(", ")} |`,
    `| Model IDs seen | ${m.modelIds.join(", ")} |`,
    `| Healer agent file SHA-256 | \`${m.healerAgentSha256}\` |`,
    `| Seed | ${m.seed} |`,
    `| Healer runs per target | ${m.healerRunsPerTarget} (Eir: 1, deterministic) |`,
    "",
    "Cost is CLI-reported (`total_cost_usd`), never computed from tokens.",
    "",
    "## Outcomes by class (per run; infra errors excluded from rates)",
    "",
    "`class-shuffle` is reported on the **strict** reading, with the lenient one beside it (see the section below).",
    "",
    ...outcomeTable([...report.perClass, ...report.overall]),
    "",
    "## Mutation-effective targets",
    "",
    "| Class | Effective | Mutation-ineffective (excluded) |",
    "| --- | ---: | --- |",
    ...Object.entries(m.effectiveTargets).map(
      ([c, n]) => `| ${c} | ${n} | ${(m.mutationIneffective[c] ?? []).join(", ") || "none"} |`,
    ),
    "",
    "## Healer cost and time",
    "",
    `Runs with a CLI-reported cost: ${report.cost.runsWithCost}; without: ${report.cost.runsWithoutCost}.`,
    "",
    "| | Cost | Wall time |",
    "| --- | ---: | ---: |",
    `| Total | ${usd(report.cost.totalUsd)} | ${secs(report.cost.totalWallMs)} |`,
    `| Median per run | ${usd(report.cost.medianUsd)} | ${secs(report.cost.medianWallMs)} |`,
    `| p90 per run | ${usd(report.cost.p90Usd)} | ${secs(report.cost.p90WallMs)} |`,
    "",
    "## Complementarity matrix (Eir result x healer majority result, targets)",
    "",
    "| Eir | Healer (majority of runs) | Targets | Which |",
    "| --- | --- | ---: | --- |",
    ...report.matrix.map(
      (c) => `| ${c.eir} | ${c.healer} | ${c.targets.length} | ${c.targets.join(", ")} |`,
    ),
    "",
    "## Healer stability across runs",
    "",
    `Targets whose outcome differed across runs: ${report.stability.filter((t) => !t.stability.outcomesMatch).length} of ${report.stability.length}. ` +
      `Targets whose final locators differed: ${report.stability.filter((t) => !t.stability.locatorsMatch).length} of ${report.stability.length}.`,
    "",
    "| Target | Majority | Outcomes | Same locators |",
    "| --- | --- | --- | --- |",
    ...report.stability.map(
      (t) =>
        `| ${t.targetId} | ${t.majority} | ${t.stability.distinctOutcomes.join(", ")} | ${t.stability.locatorsMatch ? "yes" : "no"} |`,
    ),
    "",
    "## Strict and lenient reading of class-shuffle",
    "",
    ...strictSection(report),
    "",
    "## Re-judged and adjudicated runs",
    "",
    ...rejudgedSection(report.runs),
    "",
    "## Eir repeat",
    "",
    `Run 2 matched run 1 on ${report.eirRepeat.identical} of ${report.eirRepeat.compared} targets compared.`,
    "",
  ];
  return out.join("\n");
}
