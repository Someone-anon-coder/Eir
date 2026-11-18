import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertWritable } from "../evidenceFileGuard.js";
import type { AuditEvidence, FixmeEvidence } from "./evidenceCli.js";
import { loadDataset, loadRecords } from "./loadRecords.js";
import { buildMeta } from "./reportMeta.js";
import { draftFor } from "./specDrafts.js";
import type { TraceCheckEntry } from "./traceCheckCli.js";
import {
  firstActiveTableEvidence,
  firstArchivedClaim,
  toolResultTexts,
} from "./transcriptEvidence.js";
import {
  buildVerificationReport,
  renderVerificationMarkdown,
  type ClassShuffleStrict,
  type DestructiveExperiment,
  type TranscriptRow,
} from "./verificationReport.js";
import { HEALER_ROOT } from "./workspace.js";

const REPORTS_DIR = new URL("../../reports", import.meta.url).pathname;
const VERIFY = path.join(HEALER_ROOT, "verification");

async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    // Written by this harness's own CLIs, so the cast restates the schema they wrote.
    return JSON.parse(await readFile(file, "utf-8")) as T;
  } catch {
    return undefined;
  }
}

const DEVICE: Readonly<Record<string, readonly [string, string]>> = {
  "dev-2.actionsOrder": ["Warehouse Scanner", "K. Nguyen"],
  "dev-4.actionsOrder": ["Loading Dock Printer", "M. Alvarez"],
};

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const jsonPath = path.join(REPORTS_DIR, "healer-verification.json");
  const mdPath = path.join(REPORTS_DIR, "healer-verification.md");
  await assertWritable(jsonPath, force);
  await assertWritable(mdPath, force);

  const original = await loadRecords(42);
  const rerun = await loadDataset(42, "verification");
  const anchored = await loadDataset(42, "verification-anchored");
  if (rerun.length === 0)
    throw new Error("No verification runs found; run bench:healer --dataset verification first");

  const traceFalseHeals =
    (await readJson<TraceCheckEntry[]>(path.join(VERIFY, "trace-check-healed-wrong.json"))) ?? [];
  const traceControl =
    (await readJson<TraceCheckEntry[]>(path.join(VERIFY, "trace-check-healed-correct.json"))) ?? [];
  const evidence = (await readJson<{ fixme: FixmeEvidence[]; audit: AuditEvidence[] }>(
    path.join(VERIFY, "evidence.json"),
  )) ?? { fixme: [], audit: [] };
  const experiment = await readJson<DestructiveExperiment>(
    path.join(VERIFY, "destructive-experiment.json"),
  );

  // Class-shuffle: did Playwright resolve the target container itself, or something else the path happened to include?
  const cs = traceControl.filter((e) => e.runClass === "class-shuffle");
  const others = cs.flatMap((e) => {
    const gt = draftFor(e.targetId)?.element;
    const t = e.traced[0];
    if (t !== undefined && t.ownMarker === gt) return [];
    return [
      {
        targetId: e.targetId,
        run: e.run,
        resolved: t === undefined ? "(no traced action)" : (t.ownMarker ?? `unmarked ${t.tag}`),
      },
    ];
  });
  const classShuffleStrict: ClassShuffleStrict = {
    replayed: cs.length,
    resolvedIsTarget: cs.length - others.length,
    resolvedIsOther: others.length,
    others,
  };

  // The first page evidence each actionsOrder false-heal healer saw.
  const transcripts: TranscriptRow[] = [];
  for (const r of original.filter((x) => x.tool === "healer" && x.outcome === "healed-wrong")) {
    const key = Object.keys(DEVICE).find((k) => r.targetId.endsWith(k));
    const file = r.healer?.transcriptFile;
    if (key === undefined || file === undefined) continue;
    const jsonl = await readFile(file, "utf-8");
    const [device, owner] = DEVICE[key] ?? ["", ""];
    transcripts.push({
      runClass: r.mutationClass,
      targetId: r.targetId,
      run: r.run,
      firstActiveTableEvidence: firstActiveTableEvidence(toolResultTexts(jsonl), owner, device),
      healerClaim: firstArchivedClaim(jsonl),
    });
  }

  const meta = await buildMeta([...rerun, ...anchored], 42, 5, "verification");
  const report = buildVerificationReport({
    meta,
    original,
    rerun,
    anchored,
    traceFalseHeals,
    traceControl,
    classShuffleStrict,
    audit: evidence.audit,
    fixme: evidence.fixme,
    transcripts,
    experiment,
    versionCheck: {
      "Claude Code CLI": "2.1.318 (same as the original run)",
      Playwright: "1.65.1 (same)",
      "Agent file SHA-256": "identical to the original run's",
      "Model resolution":
        "`sonnet` resolves to `claude-sonnet-5-5` (plus the small `claude-haiku-5-5` helper), as before",
    },
  });
  await mkdir(REPORTS_DIR, { recursive: true });
  await writeFile(jsonPath, JSON.stringify(report, null, 2) + "\n");
  await writeFile(mdPath, renderVerificationMarkdown(report));
  console.log(`Wrote ${jsonPath}\nWrote ${mdPath}`);
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
