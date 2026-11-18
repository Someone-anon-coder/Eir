import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { RunRecord } from "./runRecord.js";
import { HEALER_ROOT } from "./workspace.js";

async function readDir(dir: string, tool: "healer" | "eir"): Promise<RunRecord[]> {
  let names: string[];
  try {
    names = await readdir(path.join(dir, tool));
  } catch {
    return [];
  }
  const records: RunRecord[] = [];
  for (const name of names.filter((n) => n.endsWith(".json")).sort()) {
    // Records are written by this harness, so the cast restates the schema it wrote.
    records.push(JSON.parse(await readFile(path.join(dir, tool, name), "utf-8")) as RunRecord);
  }
  return records;
}

/**
 * Loads every run of one seed. The class comes from the run directory, not
 * the record: a compound-release target is stored under its source class, and
 * the same target id also exists in the source class's own directory (a
 * different build). Compound ids are prefixed so the two never merge in an
 * aggregate; the source class is kept in `sourceClass`.
 */
export async function loadRecords(seed: number): Promise<RunRecord[]> {
  const root = path.join(HEALER_ROOT, "runs");
  const out: RunRecord[] = [];
  for (const entry of (await readdir(root)).sort()) {
    const match = /^(.*)-seed(\d+)$/.exec(entry);
    if (match?.[1] === undefined || Number(match[2]) !== seed) continue;
    const runClass = match[1];
    for (const tool of ["healer", "eir"] as const) {
      for (const r of await readDir(path.join(root, entry), tool)) {
        out.push({
          ...r,
          sourceClass: r.mutationClass,
          mutationClass: runClass,
          targetId: runClass === "compound-release" ? `compound-release/${r.targetId}` : r.targetId,
        });
      }
    }
  }
  return out;
}
