import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readPolicyLogFile } from "../policyLog.js";
import { classifyEirRun, type EirClassification } from "./classify.js";
import { mapEirPolicy } from "./eirPolicy.js";
import { runPlaywright } from "./playwrightRun.js";
import type { Expectation } from "./specDraft.js";
import type { Collector } from "./ward.js";
import { HEALER_ROOT, linkNodeModules, suiteConfig, workspacePackageJson } from "./workspace.js";

/** The one-line import swap an adopter makes. */
export function swapToEir(specText: string): string {
  const swapped = specText.replace("from '@playwright/test'", "from 'playwright-eir'");
  if (swapped === specText) throw new Error("spec has no '@playwright/test' import to swap");
  return swapped;
}

export interface EirSpec {
  readonly fileName: string;
  readonly text: string;
}

export function eirClassDir(key: string): string {
  return path.join(HEALER_ROOT, "eir-work", key);
}

/**
 * Captures fingerprints on a green control run against unmutated Ward into
 * a gitignored store (never `packages/demo-app/.eir/`). Returns the titles
 * of any spec that failed on control: those cannot be fingerprinted.
 */
export async function prepareEirStore(
  classDir: string,
  specs: readonly EirSpec[],
  controlUrl: string,
): Promise<string[]> {
  await rm(classDir, { recursive: true, force: true });
  await mkdir(path.join(classDir, "tests"), { recursive: true });
  await writeFile(path.join(classDir, "package.json"), workspacePackageJson("eir-store"));
  await writeFile(
    path.join(classDir, "playwright.config.ts"),
    suiteConfig(controlUrl, { eir: true }),
  );
  await linkNodeModules(classDir, true);
  for (const spec of specs)
    await writeFile(path.join(classDir, "tests", spec.fileName), swapToEir(spec.text));
  const run = await runPlaywright(classDir, []);
  if (!run.reportParsed || run.results.length === 0) {
    throw new Error(
      "Eir control run produced no readable results; refusing to continue with an empty store",
    );
  }
  return run.results.filter((r) => r.status !== "expected").map((r) => r.title);
}

export interface EirRunResult {
  readonly classification: EirClassification;
  readonly passed: boolean;
  readonly actedOn: readonly string[];
  readonly wallMs: number;
}

/** One Eir run in heal mode, default thresholds, fallback off, from a pristine copy of the control store. */
export async function runEirOnce(
  classDir: string,
  spec: EirSpec,
  targetId: string,
  markedUrl: string,
  collector: Collector,
  element: string,
  decoyElement: string | undefined,
  expectation: Expectation,
  actedBy: "nearest" | "path" = "nearest",
): Promise<EirRunResult> {
  const started = Date.now();
  const dir = await mkdtemp(path.join(tmpdir(), "eir-run-"));
  try {
    await mkdir(path.join(dir, "tests"), { recursive: true });
    await writeFile(path.join(dir, "package.json"), workspacePackageJson("eir-run"));
    await writeFile(path.join(dir, "playwright.config.ts"), suiteConfig(markedUrl, { eir: true }));
    await writeFile(path.join(dir, "tests", spec.fileName), swapToEir(spec.text));
    await cp(path.join(classDir, ".eir"), path.join(dir, ".eir"), { recursive: true });
    await linkNodeModules(dir, true);
    const policyLog = path.join(dir, "policy.jsonl");
    collector.reset();
    const run = await runPlaywright(dir, [path.join("tests", spec.fileName)], {
      EIR_POLICY_LOG_FILE: policyLog,
    });
    const events = (await readPolicyLogFile(policyLog)).get(targetId) ?? [];
    const passed = run.allPassed;
    const actedOn = actedBy === "path" ? collector.actedOnPaths() : collector.actedOn();
    const classification = classifyEirRun({
      passed,
      policy: mapEirPolicy(events),
      actedOn,
      element,
      decoyElement,
      expectation,
    });
    return { classification, passed, actedOn, wallMs: Date.now() - started };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function readIfExists(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf-8");
  } catch {
    return undefined;
  }
}
