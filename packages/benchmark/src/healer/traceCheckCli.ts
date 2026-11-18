import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadRecords } from "./loadRecords.js";
import { resolveClass } from "./orchestrate.js";
import { runPlaywright } from "./playwrightRun.js";
import {
  compareToCollector,
  parseTraceActions,
  type TraceAgreement,
  type TracedAction,
} from "./traceRead.js";
import { assertPortsFree, PORTS, startWard, verifyWard } from "./ward.js";
import { specFileName, type HealerClass } from "./specDraft.js";
import { draftFor } from "./specDrafts.js";
import { HEALER_ROOT, linkNodeModules, suiteConfig, workspacePackageJson } from "./workspace.js";

export interface TraceCheckEntry {
  readonly runClass: string;
  readonly targetId: string;
  readonly run: number;
  readonly outcome: string;
  readonly passedOnMarked: boolean;
  readonly collectorActedOn: readonly string[];
  readonly traced: readonly TracedAction[];
  readonly agreement: TraceAgreement;
}

async function findTraces(dir: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(dir, { recursive: true }))
    if (entry.endsWith("trace.zip")) found.push(path.join(dir, entry));
  return found;
}

/**
 * Replays final specs against the marked build with Playwright tracing on and
 * reads the acted-on elements from the trace, not from the collector. Defaults
 * to every `healed-wrong` healer run.
 */
async function main(): Promise<void> {
  const only = process.argv.includes("--outcome")
    ? process.argv[process.argv.indexOf("--outcome") + 1]
    : "healed-wrong";
  const records = (await loadRecords(42)).filter(
    (r) => r.tool === "healer" && r.outcome === only && r.healer?.finalSpecFile !== undefined,
  );
  const classes = [...new Set(records.map((r) => r.mutationClass))] as HealerClass[];
  await assertPortsFree([PORTS.marked]);
  const results: TraceCheckEntry[] = [];
  for (const cls of classes) {
    const resolution = resolveClass(cls, 42);
    const opts = {
      port: PORTS.marked,
      mutationsJson: resolution.payloadJson,
      markers: true,
    } as const;
    const ward = await startWard(opts);
    try {
      await verifyWard(ward, opts);
      for (const r of records.filter((x) => x.mutationClass === cls)) {
        const sourceId = r.targetId.replace(/^compound-release\//, "");
        const spec = await readFile(r.healer?.finalSpecFile ?? "", "utf-8");
        const dir = await mkdtemp(path.join(tmpdir(), "eir-trace-"));
        try {
          await mkdir(path.join(dir, "tests"), { recursive: true });
          await writeFile(path.join(dir, "package.json"), workspacePackageJson("trace"));
          await linkNodeModules(dir, false);
          await writeFile(path.join(dir, "playwright.config.ts"), suiteConfig(ward.baseUrl));
          const file = specFileName(sourceId);
          await writeFile(path.join(dir, "tests", file), spec);
          const run = await runPlaywright(dir, [path.join("tests", file)], {}, 180_000, [
            "--trace",
            "on",
          ]);
          const ndjson = (await findTraces(dir))
            .map((zip) =>
              execFileSync("unzip", ["-p", zip, "*-trace.trace"], {
                maxBuffer: 256 * 1024 * 1024,
              }).toString("utf-8"),
            )
            .join("\n");
          const traced = parseTraceActions(ndjson);
          results.push({
            runClass: cls,
            targetId: r.targetId,
            run: r.run,
            outcome: r.outcome,
            passedOnMarked: run.allPassed,
            collectorActedOn: r.actedOn,
            traced,
            agreement: compareToCollector(
              traced,
              r.actedOn,
              draftFor(sourceId)?.actedBy === "path" ? "path" : "nearest",
            ),
          });
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }
    } finally {
      await ward.stop();
    }
  }
  const outDir = path.join(HEALER_ROOT, "verification");
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, `trace-check-${only}.json`), JSON.stringify(results, null, 2));
  const agreeing = results.filter((e) => e.agreement.agree).length;
  console.log(`Trace vs collector: ${agreeing} of ${results.length} agree (outcome=${only}).`);
  for (const e of results.filter((x) => !x.agreement.agree)) {
    console.log(
      `  DISAGREE ${e.runClass} ${e.targetId} run${e.run}: trace=${e.agreement.traceSet.join(",")} collector=${e.agreement.collectorSet.join(",")}`,
    );
  }
  for (const e of results.filter((x) => !x.passedOnMarked))
    console.log(`  NOT GREEN on replay: ${e.targetId} run${e.run}`);
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
