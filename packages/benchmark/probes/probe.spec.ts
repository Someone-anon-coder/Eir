import { test, type EirConfig } from "playwright-eir";
import { isMutationClass } from "../src/mutationClasses.js";
import { buildMutationRun } from "../src/groundTruth.js";
import { targetById } from "../src/targets.js";
import { appendGroundTruthFile } from "../src/groundTruthFile.js";

/**
 * One test per live ground-truth entry, generated in a loop at file-load
 * time (a standard, supported Playwright pattern) — not one hand-written
 * spec file per target. `EIR_BENCH_CLASS`/`EIR_BENCH_SEED` are set by the
 * harness runner (src/runner.ts) before invoking `playwright test`; reading
 * them at module load means the exact same test list is generated for the
 * control run and the mutated run of a given (class, seed), which is what
 * lets the control run prove the ground truth is valid *before* mutation.
 *
 * Every interaction uses `page` from `playwright-eir`'s own `test` fixture
 * (an `EirPage`), so the control run also exercises Phase 3's capture path
 * exactly like a real suite would — even though Phase 4's classification
 * doesn't depend on Eir's own debug log, only on this test's own pass/fail.
 */
const mutationClassEnv = process.env["EIR_BENCH_CLASS"];
const seedEnv = process.env["EIR_BENCH_SEED"];

if (mutationClassEnv === undefined || !isMutationClass(mutationClassEnv)) {
  throw new Error(
    `probe.spec.ts requires EIR_BENCH_CLASS to be set to a valid mutation class, got: ${String(mutationClassEnv)}`,
  );
}
if (seedEnv === undefined || !Number.isFinite(Number(seedEnv))) {
  throw new Error(`probe.spec.ts requires EIR_BENCH_SEED to be a finite number, got: ${String(seedEnv)}`);
}

const seed = Number(seedEnv);
const run = buildMutationRun(mutationClassEnv, seed);

/**
 * NOTE-001 retrofit's evidence mode (`healModeEvidence.ts`). Unset (every
 * other benchmark class/run) leaves `eirConfig` at its published default
 * (`suggest-only`) — Phase 4/5's original committed baselines stay
 * reproducible byte-for-byte. `0.7`/`0.3` mirror
 * `packages/eir/src/policy/thresholds.ts`'s `DEFAULT_HEAL_THRESHOLD`/
 * `DEFAULT_SUGGEST_THRESHOLD` — duplicated rather than imported, same
 * reasoning as `targets.ts`'s `OverridePayload` (Eir's `exports` map
 * doesn't publish internal constants).
 */
const modeEnv = process.env["EIR_BENCH_MODE"];
if (modeEnv === "heal") {
  const healConfig: EirConfig = {
    mode: { mode: "heal", healThreshold: 0.7, suggestThreshold: 0.3 },
  };
  test.use({ eirConfig: healConfig });
}

for (const entry of run.groundTruth) {
  test(entry.targetId, async ({ page }) => {
    const target = targetById(entry.targetId);
    try {
      await target.interact(page);
    } catch (error) {
      // near-duplicate-sibling-swap ground truth (Phase 5): read the live
      // distractor's bounding box — never clicked — so the harness can
      // independently judge whether Eir's matcher would have picked the
      // correct element or its near-duplicate twin. A no-op for every
      // other mutation class (no distractor, nothing to read) and outside
      // the benchmark (EIR_GROUND_TRUTH_FILE unset).
      if (entry.distractorId !== undefined) {
        const distractorTarget = targetById(entry.distractorId);
        if (distractorTarget.locate !== undefined) {
          const box = await distractorTarget
            .locate(page)
            .then((locator) => locator.boundingBox())
            .catch(() => null);
          await appendGroundTruthFile(
            entry.targetId,
            box === null ? null : { x: box.x, y: box.y, w: box.width, h: box.height },
          );
        }
      }
      throw error;
    }
  });
}
