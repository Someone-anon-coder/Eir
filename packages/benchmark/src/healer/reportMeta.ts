import { readFile } from "node:fs/promises";
import path from "node:path";
import { runDir } from "./orchestrate.js";
import type { ReportMeta } from "./report.js";
import type { RunRecord } from "./runRecord.js";
import { HEALER_CLASSES } from "./specDraft.js";
import { ensureTemplate, locatePlaywright } from "./workspace.js";

interface Proof {
  readonly effective: readonly string[];
  readonly mutationIneffective: readonly string[];
}

async function readProof(
  cls: string,
  seed: number,
  dataset: string | undefined,
): Promise<Proof | undefined> {
  try {
    const parsed: unknown = JSON.parse(
      await readFile(path.join(runDir(cls, seed, dataset), "proof.json"), "utf-8"),
    );
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const effective: unknown = Reflect.get(parsed, "effective");
    const ineffective: unknown = Reflect.get(parsed, "mutationIneffective");
    return Array.isArray(effective) && Array.isArray(ineffective)
      ? { effective: effective.map(String), mutationIneffective: ineffective.map(String) }
      : undefined;
  } catch {
    return undefined;
  }
}

/** The metadata block shared by the main report and the verification report. */
export async function buildMeta(
  records: readonly RunRecord[],
  seed: number,
  healerRunsPerTarget: number,
  dataset?: string,
): Promise<ReportMeta> {
  const effectiveTargets: Record<string, number> = {};
  const mutationIneffective: Record<string, readonly string[]> = {};
  for (const cls of HEALER_CLASSES) {
    const proof = await readProof(cls, seed, dataset);
    if (proof === undefined) continue;
    effectiveTargets[cls] = proof.effective.length;
    mutationIneffective[cls] = proof.mutationIneffective;
  }
  const healer = records.flatMap((r) => (r.healer === undefined ? [] : [r.healer]));
  return {
    generatedAt: new Date().toISOString(),
    playwrightVersion: locatePlaywright().version,
    claudeCodeVersions: [
      ...new Set(healer.flatMap((h) => (h.cliVersion === undefined ? [] : [h.cliVersion]))),
    ].sort(),
    modelIds: [...new Set(healer.flatMap((h) => (h.model === undefined ? [] : [h.model])))].sort(),
    healerAgentSha256: (await ensureTemplate()).healerAgentSha256,
    seed,
    healerRunsPerTarget,
    mutationIneffective,
    effectiveTargets,
  };
}
