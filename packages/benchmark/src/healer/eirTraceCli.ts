import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eirClassDir, swapToEir } from "./eirRun.js";
import { loadRecords } from "./loadRecords.js";
import { resolveClass } from "./orchestrate.js";
import { runPlaywright } from "./playwrightRun.js";
import { materializeSpec, specFileName, type HealerClass } from "./specDraft.js";
import { draftFor } from "./specDrafts.js";
import { parseTraceActions, type TracedAction } from "./traceRead.js";
import { assertPortsFree, PORTS, startWard, verifyWard } from "./ward.js";
import { HEALER_ROOT, linkNodeModules, suiteConfig, workspacePackageJson } from "./workspace.js";

export interface EirTraceEntry {
  readonly runClass: string;
  readonly targetId: string;
  readonly run: number;
  readonly outcome: string;
  readonly groundTruthElement: string;
  /** Every interaction the trace resolved to an element (the failed first attempt resolves none). */
  readonly traced: readonly TracedAction[];
  /** The element Eir's retry resolved: the last traced interaction. */
  readonly resolvedElement: string;
  readonly resolvedIsTarget: boolean;
  readonly passedOnReplay: boolean;
}

async function findTraces(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { recursive: true }))
    if (entry.endsWith("trace.zip")) out.push(path.join(dir, entry));
  return out;
}

/**
 * Replays Eir's `healed-correct` runs of one class in heal mode (default
 * thresholds, fallback off) from a pristine copy of the control store, with
 * Playwright tracing on, and reads which element the retry resolved.
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cls = (argv[argv.indexOf("--class") + 1] ?? "class-shuffle") as HealerClass;
  const records = (await loadRecords(42)).filter(
    (r) =>
      r.tool === "eir" && r.run === 1 && r.mutationClass === cls && r.outcome === "healed-correct",
  );
  await assertPortsFree([PORTS.marked]);
  const resolution = resolveClass(cls, 42);
  const opts = {
    port: PORTS.marked,
    mutationsJson: resolution.payloadJson,
    markers: true,
  } as const;
  const ward = await startWard(opts);
  const entries: EirTraceEntry[] = [];
  try {
    await verifyWard(ward, opts);
    for (const r of records) {
      const sourceId = r.targetId.replace(/^compound-release\//, "");
      const draft = draftFor(sourceId);
      if (draft === undefined) continue;
      const file = specFileName(sourceId);
      const dir = await mkdtemp(path.join(tmpdir(), "eir-eirtrace-"));
      try {
        await mkdir(path.join(dir, "tests"), { recursive: true });
        await writeFile(path.join(dir, "package.json"), workspacePackageJson("eir-trace"));
        await writeFile(
          path.join(dir, "playwright.config.ts"),
          suiteConfig(ward.baseUrl, { eir: true }),
        );
        await writeFile(path.join(dir, "tests", file), swapToEir(materializeSpec(draft)));
        await cp(path.join(eirClassDir(`${cls}-seed42`), ".eir"), path.join(dir, ".eir"), {
          recursive: true,
        });
        await linkNodeModules(dir, true);
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
        const last = traced[traced.length - 1];
        const resolved =
          last === undefined
            ? "(no traced interaction)"
            : (last.ownMarker ?? `unmarked ${last.tag}`);
        entries.push({
          runClass: cls,
          targetId: r.targetId,
          run: r.run,
          outcome: r.outcome,
          groundTruthElement: draft.element,
          traced,
          resolvedElement: resolved,
          resolvedIsTarget: last?.ownMarker === draft.element,
          passedOnReplay: run.allPassed,
        });
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }
  } finally {
    await ward.stop();
  }
  const outDir = path.join(HEALER_ROOT, "verification");
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, `trace-check-eir-${cls}.json`),
    JSON.stringify(entries, null, 2),
  );
  for (const e of entries) {
    console.log(
      `${e.targetId}: replay ${e.passedOnReplay ? "green" : "RED"}, interactions traced=${e.traced.length}, resolved=${e.resolvedElement}, GT=${e.groundTruthElement}, strict=${e.resolvedIsTarget ? "TARGET" : "OTHER"}`,
    );
  }
  console.log(
    `Eir ${cls}: ${entries.filter((e) => e.resolvedIsTarget).length} of ${entries.length} healed-correct runs resolved the target container itself.`,
  );
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
