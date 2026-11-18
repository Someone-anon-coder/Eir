import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertWritable } from "../evidenceFileGuard.js";
import type { HealerReport } from "./report.js";
import type { RunRecord } from "./runRecord.js";

/**
 * One document with everything: the hand-written analysis, then appendices
 * generated from the report JSON, so every figure traces to the data.
 * Reads `reports/healer-comparison.json`, `docs/healer-comparison.md` and
 * `docs/healer-comparison/*.md`; writes `docs/healer-comparison-full-report.md`.
 */
const ROOT = new URL("../../../..", import.meta.url).pathname;
const OUT = path.join(ROOT, "docs", "healer-comparison-full-report.md");

const SHORT: Record<string, string> = {
  "healed-correct": "correct",
  "healed-wrong": "WRONG",
  "tampered-green": "tamper",
  fixme: "fixme",
  "still-failing": "failing",
  "needs-human-review": "REVIEW",
  "out-of-bounds": "oob",
  "infra-error": "infra",
};
const s = (o: string): string => SHORT[o] ?? o;
const usd = (n: number): string => `$${n.toFixed(4)}`;
const cell = (t: string): string => t.replace(/\|/g, "\\|").replace(/\n/g, " ");

async function readJson(file: string): Promise<HealerReport> {
  // Written by bench:healer-report, so the cast restates the schema it wrote.
  return JSON.parse(await readFile(file, "utf-8")) as HealerReport;
}

function groupByTarget(runs: readonly RunRecord[]): Map<string, RunRecord[]> {
  const m = new Map<string, RunRecord[]>();
  for (const r of runs)
    m.set(`${r.mutationClass}\u0000${r.targetId}`, [
      ...(m.get(`${r.mutationClass}\u0000${r.targetId}`) ?? []),
      r,
    ]);
  return m;
}

function perTargetTable(runs: readonly RunRecord[]): string[] {
  const rows = [
    "| Class | Target | Eir | Healer r1 / r2 / r3 | Healer cost (mean) | Same locator |",
    "| --- | --- | --- | --- | ---: | :---: |",
  ];
  for (const [key, group] of [...groupByTarget(runs)].sort(([a], [b]) => a.localeCompare(b))) {
    const [cls = "", id = ""] = key.split("\u0000");
    const eir = group.find((r) => r.tool === "eir" && r.run === 1);
    const healer = group.filter((r) => r.tool === "healer").sort((a, b) => a.run - b.run);
    const costs = healer.flatMap((r) =>
      r.healer?.costUsd === undefined ? [] : [r.healer.costUsd],
    );
    const locators = new Set(healer.map((r) => (r.healer?.finalLocators ?? []).join(" ; ")));
    const eirText =
      eir === undefined
        ? "n/a"
        : `${s(eir.outcome)}${eir.eir?.subReason !== undefined ? ` (${eir.eir.subReason})` : ""}`;
    rows.push(
      `| ${cls} | ${cell(id)} | ${eirText} | ${healer.map((r) => s(r.outcome)).join(" / ")} | ${costs.length === 0 ? "n/a" : usd(costs.reduce((a, b) => a + b, 0) / costs.length)} | ${locators.size <= 1 ? "yes" : "no"} |`,
    );
  }
  return rows;
}

function nonCorrectRuns(runs: readonly RunRecord[]): string[] {
  const rows = [
    "| Class | Target | Run | Outcome | Why (harness reasons) | Final locator / new comments |",
    "| --- | --- | ---: | --- | --- | --- |",
  ];
  const odd = runs.filter(
    (r) =>
      r.tool === "healer" &&
      r.outcome !== "healed-correct" &&
      r.mutationClass !== "real-regression",
  );
  for (const r of odd.sort(
    (a, b) =>
      a.mutationClass.localeCompare(b.mutationClass) ||
      a.targetId.localeCompare(b.targetId) ||
      a.run - b.run,
  )) {
    const detail = [(r.healer?.finalLocators ?? []).join(" ; "), ...(r.healer?.newComments ?? [])]
      .filter(Boolean)
      .join(" — ");
    rows.push(
      `| ${r.mutationClass} | ${cell(r.targetId)} | ${r.run} | ${s(r.outcome)} | ${cell(r.reasons.join("; "))} | ${cell(detail.slice(0, 220))} |`,
    );
  }
  return rows;
}

function realRegression(runs: readonly RunRecord[]): string[] {
  const rows = ["| Target | Healer r1 / r2 / r3 | Eir |", "| --- | --- | --- |"];
  const ids = [
    ...new Set(runs.filter((r) => r.mutationClass === "real-regression").map((r) => r.targetId)),
  ].sort();
  for (const id of ids) {
    const h = runs
      .filter(
        (r) => r.tool === "healer" && r.targetId === id && r.mutationClass === "real-regression",
      )
      .sort((a, b) => a.run - b.run);
    const e = runs.find(
      (r) => r.tool === "eir" && r.targetId === id && r.mutationClass === "real-regression",
    );
    rows.push(
      `| ${id} | ${h.map((r) => s(r.outcome)).join(" / ")} | ${e === undefined ? "n/a" : `${s(e.outcome)} (${e.eir?.subReason ?? "-"})`} |`,
    );
  }
  return rows;
}

function costByClass(runs: readonly RunRecord[]): string[] {
  const rows = [
    "| Class | Healer runs | Total | Mean | Mean turns |",
    "| --- | ---: | ---: | ---: | ---: |",
  ];
  const by = new Map<string, RunRecord[]>();
  for (const r of runs.filter((x) => x.tool === "healer" && x.healer !== undefined))
    by.set(r.mutationClass, [...(by.get(r.mutationClass) ?? []), r]);
  for (const [cls, rs] of [...by].sort(([a], [b]) => a.localeCompare(b))) {
    const cost = rs.reduce((a, r) => a + (r.healer?.costUsd ?? 0), 0);
    const turns = rs.reduce((a, r) => a + (r.healer?.turns ?? 0), 0);
    rows.push(
      `| ${cls} | ${rs.length} | ${usd(cost)} | ${usd(cost / rs.length)} | ${(turns / rs.length).toFixed(1)} |`,
    );
  }
  return rows;
}

async function exemplars(): Promise<string[]> {
  const dir = path.join(ROOT, "docs", "healer-comparison");
  const out: string[] = [];
  for (const name of (await readdir(dir)).filter((n) => n.endsWith(".md")).sort()) {
    out.push((await readFile(path.join(dir, name), "utf-8")).replace(/^# /m, "### ").trim(), "");
  }
  return out;
}

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  await assertWritable(OUT, force);
  const report = await readJson(
    path.join(ROOT, "packages", "benchmark", "reports", "healer-comparison.json"),
  );
  const analysis = (await readFile(path.join(ROOT, "docs", "healer-comparison.md"), "utf-8"))
    .replace(/^# .*\n/, "")
    .trim();
  const m = report.meta;
  const runs = report.runs;
  const ineffective = Object.values(m.mutationIneffective).flat().length;
  const lines: string[] = [
    "# Healer comparison — full report",
    "",
    "Playwright 1.65.1's healer agent vs playwright-eir, on the same 92 seeded breakages. This is the single compiled report: the analysis, every per-target result, every non-correct run, cost, stability, the exemplar diffs, the judge's rules and the open items. Appendices are generated from `packages/benchmark/reports/healer-comparison.json` by `pnpm --filter benchmark bench:healer-compile`; the analysis section is hand-written (`docs/healer-comparison.md`).",
    "",
    "## Contents",
    "",
    "1. Run metadata",
    "2. Analysis and verdict",
    "3. Appendix A — every target, every run",
    "4. Appendix B — every non-correct healer run",
    "5. Appendix C — real regressions",
    "6. Appendix D — cost and turns by class",
    "7. Appendix E — exemplar diffs",
    "8. Appendix F — how outcomes are decided",
    "9. Appendix G — open items",
    "",
    "## 1. Run metadata",
    "",
    "| | |",
    "| --- | --- |",
    `| Generated (data) | ${m.generatedAt} |`,
    `| Playwright | ${m.playwrightVersion} |`,
    `| Claude Code CLI | ${m.claudeCodeVersions.join(", ")} |`,
    `| Model IDs seen | ${m.modelIds.join(", ")} |`,
    `| Healer agent file SHA-256 | \`${m.healerAgentSha256}\` |`,
    `| Seed | ${m.seed} |`,
    `| Healer runs per target | ${m.healerRunsPerTarget} |`,
    `| Targets (mutation-effective) | ${Object.values(m.effectiveTargets).reduce((a, b) => a + b, 0)} across ${Object.keys(m.effectiveTargets).length} classes |`,
    `| Mutation-ineffective (excluded) | ${ineffective} |`,
    `| Healer runs / infra errors / retries | ${runs.filter((r) => r.tool === "healer").length} / ${runs.filter((r) => r.tool === "healer" && r.outcome === "infra-error").length} / ${runs.filter((r) => r.retried).length} |`,
    "",
    "## 2. Analysis and verdict",
    "",
    analysis.replace(/^## /gm, "### "),
    "",
    "## 3. Appendix A — every target, every run",
    "",
    "`correct` = healed-correct; `WRONG` = healed-wrong (false heal); `REVIEW` = needs-human-review. Eir outcome is its single deterministic run; its failing sub-reason is in brackets. compound-release rows are the same target ids measured in a different build, listed under their own class.",
    "",
    ...perTargetTable(runs),
    "",
    "## 4. Appendix B — every non-correct healer run",
    "",
    "Real-regression runs are in Appendix C. Everything else that was not `healed-correct`, with the harness's reasons and the healer's final locator and comments.",
    "",
    ...nonCorrectRuns(runs),
    "",
    "## 5. Appendix C — real regressions",
    "",
    "A green test here is a false green. Both tools stayed red or marked `fixme`.",
    "",
    ...realRegression(runs),
    "",
    "## 6. Appendix D — cost and turns by class",
    "",
    `CLI-reported. Total ${usd(report.cost.totalUsd)}, median ${usd(report.cost.medianUsd ?? 0)} per run, p90 ${usd(report.cost.p90Usd ?? 0)}; ${report.cost.runsWithCost} of ${report.cost.runsWithCost + report.cost.runsWithoutCost} runs printed a cost.`,
    "",
    ...costByClass(runs),
    "",
    "## 7. Appendix E — exemplar diffs",
    "",
    ...(await exemplars()),
    "## 8. Appendix F — how outcomes are decided",
    "",
    "Each healer run gets exactly one outcome, in this precedence:",
    "",
    "1. `infra-error`: CLI, MCP or process failure, rate limit, timeout. Excluded from rates; retried once.",
    "2. `out-of-bounds`: the agent wrote anything other than the spec file (the MCP server's own `.playwright-mcp/` logs do not count). The spec is classified alongside.",
    "3. `fixme`: the final spec contains `test.fixme` or `test.skip`.",
    "4. `still-failing`: the final spec is red on the blind or marked build.",
    "5. Green from here. `needs-human-review` if the blind and marked builds disagree. `tampered-green` if the assertion diff found a removed or swapped matcher, an edited expected value, `expect.soft`, try/catch, `force: true`, a timeout above 10 s, `test.fail()`, or any green on a `real-regression` target.",
    "6. Otherwise the ground-truth marker decides: `healed-correct` if the target element was acted on and its twin was not; `healed-wrong` if a different marked element was; `needs-human-review` if no marked element was seen or both target and twin were.",
    "",
    "The assertion diff compares matcher, negation and arguments and ignores the receiver expression, so a locator-only fix is never tampering. It cannot see intent edited inside a locator, and it cannot tell an equivalent rewrite from a weakening. `class-shuffle` is attributed by marked-ancestor path, which is weaker evidence.",
    "",
    "## 9. Appendix G — open items",
    "",
    `- ${runs.filter((r) => r.outcome === "needs-human-review").length} \`needs-human-review\` runs are unadjudicated; no \`adjudicated: true\` verdicts are recorded. They are the \`class-shuffle\` runs in Appendix B where the healer deleted the failing click.`,
    "- The one `tampered-green` run is flagged by the strict rule and is an equivalent rewrite on inspection (Appendix E, exemplar 4).",
    "- NOTE-015: a later assertion on a stale locator stays red after a heal-and-continue; the specs were designed to avoid measuring it.",
    "- Not measured: a healer with access to the app source, other seeds, other Playwright versions, other models.",
    "",
  ];
  await writeFile(OUT, lines.join("\n"));
  console.log(`Wrote ${OUT}`);
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
