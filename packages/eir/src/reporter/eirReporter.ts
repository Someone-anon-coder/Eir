import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import type { FallbackRowVerdict } from "../fallback/verdict.js";
import type { SerializedPolicyEvent } from "../policy/policyLogFile.js";

/** Re-exported so `playwright-eir/reporter` consumers (the ci-action) can type the fallback verdict without a deep import the exports map forbids. */
export type { FallbackRowVerdict } from "../fallback/verdict.js";

/**
 * Blueprint §7.7's reporter: a run-end heal-summary table printed to the
 * console, plus `eir-report.json` + `eir-report.md` artifacts and a
 * screenshot per matched/healed element — the trust artifact this
 * phase's Understanding Gate covered (a confidence number tells you
 * nothing at a glance; a picture of the matched element does).
 *
 * Reads from `TestResult.attachments` — the standard Playwright-reporter
 * channel the `eirPolicyLog` fixture writes to (`eir-policy-event:<n>` /
 * `eir-heal-screenshot:<n>`) — never from `EIR_POLICY_LOG_FILE` (that's
 * the benchmark harness's own opt-in JSONL channel, a separate concern).
 * Works with any Playwright run, not just the monorepo's own.
 */

export interface EirReporterOptions {
  /** Where `eir-report.json`/`.md` and `screenshots/` are written, relative to CWD. Defaults to `eir-report`. */
  readonly outputDir?: string;
}

export type HealAction =
  | "healed"
  | "suggested"
  | "missed"
  | "heal-rejected"
  | "heal-attempt-failed"
  | "drift-suspected";

/**
 * Phase 8 (Gate 3 decision: extend, deliberately): an LLM-assisted row is
 * structurally distinguishable from a purely heuristic one — provenance
 * is trust-relevant data, not wording. `null` = the fallback never ran
 * for this row (off, no key, or the trigger predicate didn't fire —
 * including, by construction, every `healed` row).
 */
export interface ReportRowFallback {
  readonly provider: string;
  readonly verdict: FallbackRowVerdict;
  readonly detail: string | null;
}

export interface ReportRow {
  readonly testTitle: string;
  readonly method: string;
  readonly route: string;
  readonly selectorKey: string;
  readonly action: HealAction;
  readonly confidence: number | null;
  readonly suggestion: string | null;
  /** Path relative to the report's own output directory, or `null` if no screenshot was captured. */
  readonly screenshotFile: string | null;
  readonly fallback: ReportRowFallback | null;
}

const POLICY_EVENT_NAME = /^eir-policy-event:(\d+)$/;
const HEAL_SCREENSHOT_NAME = /^eir-heal-screenshot:(\d+)$/;

function sanitizeForFilename(value: string): string {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/-+/g, "-").slice(0, 80);
}

function actionFor(event: Extract<SerializedPolicyEvent, { kind: "heal-attempt" }>): HealAction {
  if (event.action.kind === "heal-and-continue") {
    if (event.retryOutcome.kind === "healed") return "healed";
    if (event.retryOutcome.kind === "heal-rejected-post-condition-mismatch") return "heal-rejected";
    return "heal-attempt-failed";
  }
  return event.action.kind === "fail-with-suggestion" ? "suggested" : "missed";
}

/** `Buffer` at runtime; the attachment's own `body` may already be a Node `Buffer`, so this only reads from disk when only `path` is present (e.g. a very large attachment Playwright chose to spill). */
async function attachmentBytes(attachment: TestResult["attachments"][number]): Promise<Buffer | null> {
  if (attachment.body !== undefined) return attachment.body;
  if (attachment.path !== undefined) return readFile(attachment.path);
  return null;
}

export class EirReporter implements Reporter {
  readonly #outputDir: string;
  readonly #rows: ReportRow[] = [];
  readonly #pendingScreenshots: Map<string, TestResult["attachments"][number]> = new Map();

  constructor(options: EirReporterOptions = {}) {
    this.#outputDir = options.outputDir ?? "eir-report";
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const eventsByIndex = new Map<number, SerializedPolicyEvent>();
    const screenshotsByIndex = new Map<number, TestResult["attachments"][number]>();

    for (const attachment of result.attachments) {
      const eventMatch = POLICY_EVENT_NAME.exec(attachment.name);
      if (eventMatch?.[1] !== undefined && attachment.body !== undefined) {
        const parsed: unknown = JSON.parse(attachment.body.toString("utf8"));
        eventsByIndex.set(Number(eventMatch[1]), parsed as SerializedPolicyEvent);
        continue;
      }
      const screenshotMatch = HEAL_SCREENSHOT_NAME.exec(attachment.name);
      if (screenshotMatch?.[1] !== undefined) {
        screenshotsByIndex.set(Number(screenshotMatch[1]), attachment);
      }
    }

    for (const [index, event] of eventsByIndex) {
      let screenshotFile: string | null = null;
      const screenshotAttachment = screenshotsByIndex.get(index);
      if (screenshotAttachment !== undefined) {
        screenshotFile = `screenshots/${sanitizeForFilename(test.title)}-${index}.png`;
        // Resolved lazily in onEnd (attachmentBytes needs to await disk reads for path-only attachments).
        this.#pendingScreenshots.set(screenshotFile, screenshotAttachment);
      }

      if (event.kind === "drift-suspected") {
        this.#rows.push({
          testTitle: test.title,
          method: event.method,
          route: event.route,
          selectorKey: event.selectorKey,
          action: "drift-suspected",
          confidence: event.score,
          suggestion: null,
          screenshotFile,
          fallback: null,
        });
        continue;
      }

      const confidence = event.matchAttempt.kind === "matched" ? event.matchAttempt.confidence : null;
      const suggestion =
        event.matchAttempt.kind === "matched" && event.matchAttempt.suggestion !== null
          ? event.matchAttempt.suggestion.description
          : null;

      this.#rows.push({
        testTitle: test.title,
        method: event.method,
        route: event.route,
        selectorKey: event.selectorKey,
        action: actionFor(event),
        confidence,
        suggestion,
        screenshotFile,
        // Call meta (latency/tokens) stays in the policy JSONL for the
        // benchmark; the report row carries only what a reader needs.
        fallback:
          event.fallback === null
            ? null
            : {
                provider: event.fallback.provider,
                verdict: event.fallback.verdict,
                detail: event.fallback.detail,
              },
      });
    }
  }

  async onEnd(): Promise<void> {
    await mkdir(path.join(this.#outputDir, "screenshots"), { recursive: true });

    for (const [file, attachment] of this.#pendingScreenshots) {
      const bytes = await attachmentBytes(attachment);
      if (bytes !== null) {
        await writeFile(path.join(this.#outputDir, file), bytes);
      }
    }

    await writeFile(
      path.join(this.#outputDir, "eir-report.json"),
      `${JSON.stringify({ rows: this.#rows }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(path.join(this.#outputDir, "eir-report.md"), this.#renderMarkdown(), "utf8");

    this.#printConsoleSummary();
  }

  #renderMarkdown(): string {
    const header = "| Test | Route | Selector | Action | Confidence | Suggestion | LLM fallback | Screenshot |\n|---|---|---|---|---|---|---|---|";
    const lines = this.#rows.map((row) => {
      const confidence = row.confidence === null ? "" : row.confidence.toFixed(4);
      const suggestion = row.suggestion ?? "";
      const fallback = row.fallback === null ? "" : `${row.fallback.provider}: ${row.fallback.verdict}`;
      const screenshot = row.screenshotFile !== null ? `![](${row.screenshotFile})` : "";
      return `| ${row.testTitle} | ${row.route} | ${row.selectorKey} | ${row.action} | ${confidence} | ${suggestion} | ${fallback} | ${screenshot} |`;
    });
    if (lines.length === 0) {
      return "# Eir Heal Report\n\nNo heal-eligible activity this run.\n";
    }
    return `# Eir Heal Report\n\n${header}\n${lines.join("\n")}\n`;
  }

  #printConsoleSummary(): void {
    if (this.#rows.length === 0) return;
    console.log("\n[eir] heal summary:");
    for (const row of this.#rows) {
      const confidence = row.confidence === null ? "" : ` (confidence ${row.confidence.toFixed(4)})`;
      const fallback = row.fallback === null ? "" : ` [llm ${row.fallback.provider}: ${row.fallback.verdict}]`;
      console.log(`  ${row.action.padEnd(20)} ${row.route} :: ${row.selectorKey}${confidence}${fallback}`);
    }
  }
}

export default EirReporter;
