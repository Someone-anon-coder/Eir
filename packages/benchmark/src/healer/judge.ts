import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runPlaywright } from "./playwrightRun.js";
import type { Collector } from "./ward.js";
import { linkNodeModules, suiteConfig, workspacePackageJson } from "./workspace.js";

export interface JudgeUrls {
  readonly blind: string;
  readonly marked: string;
}

export interface SpecVerdict {
  readonly passesBlind: boolean;
  readonly passesMarked: boolean;
  /** Distinct marked elements the spec acted on during the marked run. */
  readonly actedOn: readonly string[];
}

/**
 * Re-runs a final spec in a clean directory against the blind build and the
 * marked build of the same mutation. The healer never sees the marked
 * build; the collector tells the judge which marked element the spec acted
 * on, whatever locator it used.
 */
export async function judgeSpec(
  specFileName: string,
  specText: string,
  urls: JudgeUrls,
  collector: Collector,
): Promise<SpecVerdict> {
  const dir = await mkdtemp(path.join(tmpdir(), "eir-judge-"));
  try {
    await mkdir(path.join(dir, "tests"), { recursive: true });
    await writeFile(path.join(dir, "package.json"), workspacePackageJson("judge"));
    await writeFile(path.join(dir, "tests", specFileName), specText);
    await linkNodeModules(dir, false);
    const file = path.join("tests", specFileName);

    await writeFile(path.join(dir, "playwright.config.ts"), suiteConfig(urls.blind));
    const blind = await runPlaywright(dir, [file]);

    await writeFile(path.join(dir, "playwright.config.ts"), suiteConfig(urls.marked));
    collector.reset();
    const marked = await runPlaywright(dir, [file]);
    return {
      passesBlind: blind.allPassed,
      passesMarked: marked.allPassed,
      actedOn: collector.actedOn(),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
