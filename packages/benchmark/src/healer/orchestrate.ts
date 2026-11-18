import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildMutationRun } from "../groundTruth.js";
import { isMutationClass } from "../mutationClasses.js";
import { BudgetGuard } from "./budget.js";
import { classifyHealerRun, type Judgement, type StoppedBy } from "./classify.js";
import { buildNewKindRun, isNewKindClass } from "./comparisonTargets.js";
import { eirClassDir, prepareEirStore, runEirOnce } from "./eirRun.js";
import { readHealPrompt, runHealerAgent } from "./healerRun.js";
import { judgeSpec } from "./judge.js";
import { runPlaywright } from "./playwrightRun.js";
import { planRuns, runFilePath, type RunKey, type Tool } from "./resume.js";
import type { EirDetail, HealerDetail, RunRecord } from "./runRecord.js";
import { materializeSpec, specFileName, type HealerClass, type SpecDraft } from "./specDraft.js";
import { extractSpecFacts } from "./specFacts.js";
import { draftFor } from "./specDrafts.js";
import { detectTamper } from "./tamper.js";
import {
  assertPortsFree,
  PORTS,
  startCollector,
  startWard,
  verifyWard,
  type WardHandle,
} from "./ward.js";
import {
  createHealerWorkspace,
  ensureTemplate,
  HEALER_ROOT,
  linkNodeModules,
  outOfBoundsPaths,
  snapshotFiles,
  suiteConfig,
  workspacePackageJson,
  type Template,
} from "./workspace.js";

export interface ClassRunOptions {
  readonly mutationClass: HealerClass;
  readonly seed: number;
  readonly healerRuns: number;
  readonly eirRuns: number;
  readonly tools: readonly Tool[];
  readonly maxTurns: number;
  readonly maxRunUsd: number;
  readonly wallTimeoutMs: number;
  readonly budget: BudgetGuard;
  readonly targetFilter: readonly string[] | undefined;
  readonly log: (line: string) => void;
}

export interface ClassResolution {
  readonly payloadJson: string;
  readonly targetIds: readonly string[];
}

export function resolveClass(mutationClass: HealerClass, seed: number): ClassResolution {
  if (isMutationClass(mutationClass)) {
    const run = buildMutationRun(mutationClass, seed);
    return {
      payloadJson: JSON.stringify(run.overridePayload),
      targetIds: run.groundTruth.map((g) => g.targetId),
    };
  }
  if (isNewKindClass(mutationClass)) {
    const run = buildNewKindRun(mutationClass, seed);
    return {
      payloadJson: JSON.stringify(run.overridePayload),
      targetIds: run.targets.map((t) => t.id),
    };
  }
  throw new Error(`Unknown class: ${mutationClass}`);
}

export function runDir(mutationClass: string, seed: number): string {
  return path.join(HEALER_ROOT, "runs", `${mutationClass}-seed${seed}`);
}

async function exists(file: string): Promise<boolean> {
  try {
    await readFile(file);
    return true;
  } catch {
    return false;
  }
}

async function specDir(specs: ReadonlyMap<string, string>, baseUrl: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "eir-specs-"));
  await mkdir(path.join(dir, "tests"), { recursive: true });
  await writeFile(path.join(dir, "package.json"), workspacePackageJson("specs"));
  await writeFile(path.join(dir, "playwright.config.ts"), suiteConfig(baseUrl));
  await linkNodeModules(dir, false);
  for (const [fileName, text] of specs) await writeFile(path.join(dir, "tests", fileName), text);
  return dir;
}

export interface ProofResult {
  readonly controlFailures: readonly string[];
  /** Targets whose spec still passed on the mutated build: excluded from rates. */
  readonly mutationIneffective: readonly string[];
}

/** Every spec must pass on unmutated Ward (control) and fail on the mutated build (mutation-effective). */
export async function proveSpecs(
  specs: ReadonlyMap<string, string>,
  titleByFile: ReadonlyMap<string, string>,
  controlUrl: string,
  blindUrl: string,
): Promise<ProofResult> {
  const control = await specDir(specs, controlUrl);
  const mutated = await specDir(specs, blindUrl);
  try {
    const c = await runPlaywright(control, []);
    const controlFailures = c.results.filter((r) => r.status !== "expected").map((r) => r.title);
    if (!c.reportParsed) controlFailures.push("(control report unreadable)");
    const m = await runPlaywright(mutated, []);
    const titles = new Set([...titleByFile.values()]);
    const mutationIneffective = m.results
      .filter((r) => titles.has(r.title) && r.status === "expected")
      .map((r) => r.title);
    return { controlFailures, mutationIneffective };
  } finally {
    await rm(control, { recursive: true, force: true });
    await rm(mutated, { recursive: true, force: true });
  }
}

function lineDiff(a: string, b: string): { added: number; removed: number } {
  const x = a.split("\n");
  const y = b.split("\n");
  const dp: number[][] = Array.from({ length: x.length + 1 }, () =>
    new Array<number>(y.length + 1).fill(0),
  );
  for (let i = x.length - 1; i >= 0; i--) {
    for (let j = y.length - 1; j >= 0; j--) {
      const row = dp[i];
      const below = dp[i + 1];
      if (row === undefined || below === undefined) continue;
      row[j] = x[i] === y[j] ? (below[j + 1] ?? 0) + 1 : Math.max(below[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  const common = dp[0]?.[0] ?? 0;
  return { added: y.length - common, removed: x.length - common };
}

interface Env {
  readonly template: Template;
  readonly blind: WardHandle;
  readonly marked: WardHandle;
  readonly collector: Awaited<ReturnType<typeof startCollector>>;
  readonly prompt: string;
}

async function healerOnce(
  draft: SpecDraft,
  key: RunKey,
  seed: number,
  originalSpec: string,
  env: Env,
  options: ClassRunOptions,
): Promise<RunRecord> {
  const startedAt = new Date().toISOString();
  const fileName = specFileName(draft.targetId);
  const specRel = path.join("tests", fileName);
  const workspace = await createHealerWorkspace(
    env.template,
    env.blind.baseUrl,
    fileName,
    originalSpec,
  );
  const safe = fileName.replace(/\.spec\.ts$/, "");
  const transcriptFile = path.join(
    runDir(options.mutationClass, seed),
    "transcripts",
    `${safe}.run${key.run}.jsonl`,
  );
  const finalSpecFile = path.join(
    runDir(options.mutationClass, seed),
    "final-specs",
    `${safe}.run${key.run}.spec.ts`,
  );
  try {
    const before = await snapshotFiles(workspace);
    const agent = await runHealerAgent({
      workspace,
      prompt: env.prompt,
      transcriptFile,
      maxTurns: options.maxTurns,
      maxBudgetUsd: options.maxRunUsd,
      wallTimeoutMs: options.wallTimeoutMs,
    });
    const after = await snapshotFiles(workspace);
    const outside = outOfBoundsPaths(before, after, specRel);

    const parsed = agent.parsed;
    const run = parsed.ok ? parsed.run : undefined;
    const partial = parsed.ok ? parsed.run : parsed.partial;
    const rateLimited = (run?.rateLimitStatuses ?? partial.rateLimitStatuses ?? []).includes(
      "rejected",
    );
    const infraError =
      agent.killedFor === "timeout" ||
      rateLimited ||
      (agent.killedFor === undefined && (!parsed.ok || parsed.run.isError));
    const stoppedBy: StoppedBy =
      agent.killedFor === "max-turns"
        ? "max-turns"
        : (run?.terminalReason ?? "").includes("budget")
          ? "budget"
          : "completed";

    const finalSpec = await readFile(path.join(workspace, specRel), "utf-8").catch(() => undefined);
    if (finalSpec !== undefined) {
      await mkdir(path.dirname(finalSpecFile), { recursive: true });
      await writeFile(finalSpecFile, finalSpec);
    }
    const facts = finalSpec === undefined ? undefined : extractSpecFacts(finalSpec);
    const originalFacts = extractSpecFacts(originalSpec);
    const tamper = finalSpec === undefined ? [] : detectTamper(originalSpec, finalSpec);
    const verdict =
      finalSpec === undefined || infraError
        ? undefined
        : await judgeSpec(
            fileName,
            finalSpec,
            { blind: env.blind.baseUrl, marked: env.marked.baseUrl },
            env.collector,
          );

    const judgement: Judgement = {
      infraError,
      editedOutsideSpec: outside.length > 0,
      stoppedBy,
      // A deleted/renamed spec is a test that no longer exists: not healed.
      passesBlind: finalSpec === undefined ? false : verdict?.passesBlind,
      passesMarked: finalSpec === undefined ? false : verdict?.passesMarked,
      markedFixme: facts?.markedFixme ?? false,
      tamper,
      actedOn: verdict?.actedOn ?? [],
      element: draft.element,
      decoyElement: draft.decoyElement,
      expectation: draft.expectation,
    };
    const classification = classifyHealerRun(judgement);
    const diff =
      finalSpec === undefined ? { added: 0, removed: 0 } : lineDiff(originalSpec, finalSpec);
    const detail: HealerDetail = {
      model: run?.model ?? partial.model,
      modelsInUsage: run?.modelsInUsage ?? [],
      cliVersion: run?.cliVersion ?? partial.cliVersion,
      turns: run?.turns ?? partial.assistantEvents ?? 0,
      assistantEvents: run?.assistantEvents ?? partial.assistantEvents ?? 0,
      costUsd: run?.costUsd,
      wallMs: agent.wallMs,
      durationMs: run?.durationMs,
      apiDurationMs: run?.apiDurationMs,
      usage: run?.usage,
      stoppedBy,
      terminalReason: run?.terminalReason,
      permissionDenials: run?.permissionDenials ?? 0,
      rateLimitStatuses: run?.rateLimitStatuses ?? partial.rateLimitStatuses ?? [],
      toolCalls: run?.toolCalls ?? partial.toolCalls ?? [],
      linesAdded: diff.added,
      linesRemoved: diff.removed,
      finalLocators: facts?.actionLocators ?? [],
      tamper,
      editedOutside: outside,
      newComments: (facts?.comments ?? []).filter((c) => !originalFacts.comments.includes(c)),
      transcriptFile,
      finalSpecFile: finalSpec === undefined ? undefined : finalSpecFile,
    };
    return {
      schema: 1,
      tool: "healer",
      targetId: draft.targetId,
      mutationClass: draft.mutationClass,
      run: key.run,
      seed,
      expectation: draft.expectation,
      startedAt,
      outcome: classification.outcome,
      specOutcome: classification.specOutcome,
      reasons: classification.reasons,
      actedOn: verdict?.actedOn ?? [],
      retried: false,
      adjudicated: false,
      healer: detail,
      eir: undefined,
    };
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

export interface ClassRunSummary {
  readonly mutationClass: HealerClass;
  readonly targets: number;
  readonly mutationIneffective: readonly string[];
  readonly ran: number;
  readonly skipped: number;
  readonly stoppedForBudget: boolean;
}

export async function runClassComparison(options: ClassRunOptions): Promise<ClassRunSummary> {
  const { mutationClass, seed, log } = options;
  const resolution = resolveClass(mutationClass, seed);
  const filter = options.targetFilter;
  const targetIds = resolution.targetIds.filter(
    (id) => filter === undefined || filter.includes(id),
  );
  const drafts: SpecDraft[] = [];
  const missing: string[] = [];
  for (const id of targetIds) {
    const d = draftFor(id);
    if (d === undefined) missing.push(id);
    else drafts.push(d);
  }
  if (missing.length > 0) {
    throw new Error(
      `No spec draft yet for ${missing.length} target(s) of ${mutationClass}: ${missing.join(", ")}`,
    );
  }

  await assertPortsFree([PORTS.blind, PORTS.marked, PORTS.control, PORTS.collector]);
  const collector = await startCollector(PORTS.collector);
  const handles: WardHandle[] = [];
  try {
    const originals = new Map(drafts.map((d) => [d.targetId, materializeSpec(d)] as const));
    const specs = new Map(
      drafts.map((d) => [specFileName(d.targetId), originals.get(d.targetId) ?? ""] as const),
    );
    const titleByFile = new Map(drafts.map((d) => [specFileName(d.targetId), d.targetId] as const));

    const controlOpts = { port: PORTS.control } as const;
    const blindOpts = { port: PORTS.blind, mutationsJson: resolution.payloadJson } as const;
    const markedOpts = {
      port: PORTS.marked,
      mutationsJson: resolution.payloadJson,
      markers: true,
      collectorUrl: collector.url,
    } as const;
    const control = await startWard(controlOpts);
    handles.push(control);
    await verifyWard(control, controlOpts);
    const blind = await startWard(blindOpts);
    handles.push(blind);
    await verifyWard(blind, blindOpts);

    log(`[${mutationClass}] proving ${drafts.length} specs: control green, mutated red…`);
    const proof = await proveSpecs(specs, titleByFile, control.baseUrl, blind.baseUrl);
    if (proof.controlFailures.length > 0) {
      throw new Error(
        `Control run failed for: ${proof.controlFailures.join(", ")} — the spec or ground truth is invalid`,
      );
    }
    const ineffective = new Set(proof.mutationIneffective);
    const effective = drafts.filter((d) => !ineffective.has(d.targetId));
    log(
      `[${mutationClass}] ${effective.length} mutation-effective, ${ineffective.size} mutation-ineffective (excluded)`,
    );
    const outDir = runDir(mutationClass, seed);
    await mkdir(outDir, { recursive: true });
    await writeFile(
      path.join(outDir, "proof.json"),
      JSON.stringify(
        {
          controlPassed: drafts.length,
          effective: effective.map((d) => d.targetId),
          mutationIneffective: [...ineffective],
        },
        null,
        2,
      ),
    );

    const marked = await startWard(markedOpts);
    handles.push(marked);
    await verifyWard(marked, markedOpts);

    const plan = planRuns({
      targetIds: effective.map((d) => d.targetId),
      tools: options.tools,
      healerRuns: options.healerRuns,
      eirRuns: options.eirRuns,
      exists: () => false,
    });
    const pending: RunKey[] = [];
    let skipped = 0;
    for (const key of plan.pending) {
      if (await exists(runFilePath(outDir, key))) skipped++;
      else pending.push(key);
    }

    const template = await ensureTemplate();
    const prompt = await readHealPrompt();
    const env: Env = { template, blind, marked, collector, prompt };
    const needsEir = pending.some((k) => k.tool === "eir");
    const eirKey = `${mutationClass}-seed${seed}`;
    if (needsEir) {
      const failed = await prepareEirStore(
        eirClassDir(eirKey),
        effective.map((d) => ({
          fileName: specFileName(d.targetId),
          text: originals.get(d.targetId) ?? "",
        })),
        control.baseUrl,
      );
      if (failed.length > 0)
        log(
          `[${mutationClass}] Eir control run: ${failed.length} spec(s) not green: ${failed.join(", ")}`,
        );
    }

    let ran = 0;
    let stoppedForBudget = false;
    for (const key of pending) {
      if (options.budget.exceeded) {
        stoppedForBudget = true;
        log(
          `[budget] limit reached after ${ran} runs; stopping cleanly (CLI-reported total $${options.budget.totalUsd.toFixed(4)})`,
        );
        break;
      }
      const draft = effective.find((d) => d.targetId === key.targetId);
      if (draft === undefined) continue;
      const original = originals.get(draft.targetId) ?? "";
      let record: RunRecord;
      if (key.tool === "healer") {
        record = await healerOnce(draft, key, seed, original, env, options);
        if (record.outcome === "infra-error") {
          log(
            `[retry] ${key.targetId} run${key.run}: infra-error (${record.reasons.join("; ")}), retrying once`,
          );
          options.budget.record(record.healer?.costUsd);
          record = {
            ...(await healerOnce(draft, key, seed, original, env, options)),
            retried: true,
          };
        }
        options.budget.record(record.healer?.costUsd);
      } else {
        const result = await runEirOnce(
          eirClassDir(eirKey),
          { fileName: specFileName(draft.targetId), text: original },
          draft.targetId,
          marked.baseUrl,
          collector,
          draft.element,
          draft.decoyElement,
          draft.expectation,
        );
        const c = result.classification;
        const eir: EirDetail = {
          passed: result.passed,
          policyKind:
            c.subReason ??
            (c.outcome === "healed-correct" || c.outcome === "healed-wrong" ? "healed" : "none"),
          subReason: c.subReason,
          wallMs: result.wallMs,
          falseGreen: c.falseGreen,
        };
        record = {
          schema: 1,
          tool: "eir",
          targetId: draft.targetId,
          mutationClass: draft.mutationClass,
          run: key.run,
          seed,
          expectation: draft.expectation,
          startedAt: new Date().toISOString(),
          outcome: c.outcome,
          specOutcome: undefined,
          reasons: c.reasons,
          actedOn: result.actedOn,
          retried: false,
          adjudicated: false,
          healer: undefined,
          eir,
        };
      }
      const file = runFilePath(outDir, key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify(record, null, 2));
      ran++;
      log(
        `[${key.tool}] ${key.targetId} run${key.run}: ${record.outcome}` +
          (record.healer?.costUsd !== undefined
            ? ` ($${record.healer.costUsd.toFixed(4)}, ${record.healer.turns} turns)`
            : ""),
      );
    }
    return {
      mutationClass,
      targets: effective.length,
      mutationIneffective: [...ineffective],
      ran,
      skipped,
      stoppedForBudget,
    };
  } finally {
    for (const h of handles.reverse()) await h.stop();
    await collector.stop();
  }
}
