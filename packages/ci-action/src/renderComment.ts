import type { HealAction, ReportRow } from "playwright-eir/reporter";
import { dedupeReportRows } from "./dedupe.js";
import { REPORT_MARKER } from "./marker.js";

/**
 * `ReportRow` carries no field recording which policy mode produced a run
 * (Phase 7 consumes the artifact, it doesn't extend it — see NOTES.md
 * NOTE-004 for the same shape constraint applied to post-condition
 * verification). Row content alone can prove `"heal"` was active (only
 * heal mode ever produces `healed`/`heal-rejected`/`heal-attempt-failed`
 * rows) but can never prove `"suggest-only"` — an all-`suggested` run is
 * equally consistent with heal mode simply never crossing its threshold.
 * Rather than guess, the caller (which knows its own `eir.config.ts`)
 * states it explicitly; `"unknown"` renders no mode claim at all.
 */
export type ReportedMode = "suggest-only" | "heal" | "unknown";

export interface RenderCommentInput {
  readonly rows: readonly ReportRow[];
  /**
   * A link to this run's uploaded `eir-report` artifact (screenshots
   * included), or `null` when there's nothing to link (not running in
   * Actions, or no row captured a screenshot). Screenshots are never
   * inlined as `data:` URIs — confirmed live against a real GitHub PR
   * comment (`body_html`) that GitHub's comment sanitizer strips `img
   * src` for `data:` URIs entirely, silently rendering a blank image.
   * Blueprint §6 rules out a hosted service to work around that
   * ("local files + CI artifacts only"), so a workflow artifact link is
   * the honest answer, not a fallback.
   */
  readonly screenshotArtifactUrl: string | null;
  readonly mode: ReportedMode;
  /** Link target for the footer's "how Eir scores a suggestion" line. */
  readonly docsUrl: string;
}

const BADGE_BY_ACTION: Readonly<Record<HealAction, string>> = {
  healed: "HEALED",
  suggested: "SUGGESTED",
  "heal-rejected": "HEAL REJECTED",
  "heal-attempt-failed": "HEAL ATTEMPT FAILED",
  missed: "MISSED",
  "drift-suspected": "DRIFT SUSPECTED",
};

/** Rows with a diff worth showing — everything else (missed / drift-suspected, or any row Eir had no suggestion for) is honestly summarized in one aside line rather than given a fake diff. */
function hasDiff(row: ReportRow): boolean {
  return row.suggestion !== null;
}

function diffCell(row: ReportRow): string {
  const suggestion = row.suggestion ?? "";
  return `\`- ${row.selectorKey}\`<br>\`+ ${suggestion}\``;
}

function confidenceCell(row: ReportRow, seenCount: number): string {
  const value = row.confidence === null ? "—" : row.confidence.toFixed(4);
  return seenCount > 1 ? `${value} (seen ${seenCount}x)` : value;
}

/** Provenance marker (Phase 8): a row the LLM fallback weighed in on is visually distinct in the table itself, not only in the detail block below it. */
function llmMarker(row: ReportRow): string {
  return row.fallback === null ? "" : " · ⚠ LLM";
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * NOTE-004 (Phase 9): now that `ReportRow` distinguishes *why* a heal's
 * post-condition check passed, the comment states the real breakdown
 * instead of a blanket "can't tell" disclaimer. `verified` is a genuine,
 * independent correctness check; `skipped-no-baseline` — no post-condition
 * was ever recorded for this selector — is a materially weaker signal and
 * is called out by name so a reviewer knows which HEALED rows to look at
 * more closely.
 */
function renderVerificationNote(rows: readonly ReportRow[]): string | null {
  const healedRows = rows.filter((row) => row.action === "healed");
  if (healedRows.length === 0) return null;

  const verified = healedRows.filter((row) => row.postConditionVerification === "verified").length;
  const skippedNone = healedRows.filter((row) => row.postConditionVerification === "skipped-none").length;
  const noBaseline = healedRows.filter(
    (row) => row.postConditionVerification === "skipped-no-baseline" || row.postConditionVerification == null,
  ).length;

  const parts: string[] = [];
  if (verified > 0) parts.push(`${pluralize(verified, "row")} genuinely verified against a recorded post-condition`);
  if (skippedNone > 0) parts.push(`${pluralize(skippedNone, "row")} had nothing observable to check, by design`);
  if (noBaseline > 0) {
    parts.push(`${pluralize(noBaseline, "row")} accepted on margin alone — no prior baseline existed to verify against`);
  }

  return `Of the ${pluralize(healedRows.length, "HEALED row")} above: ${parts.join("; ")}. Treat every **HEALED** row as "retried and passed," and weigh the unverified ones more carefully.`;
}

function renderModeLine(mode: ReportedMode): string | null {
  switch (mode) {
    case "suggest-only":
      return "Mode: **suggest-only** — none of the actions above were retried and nothing was modified. Review each suggestion and update your selector by hand if it looks right.";
    case "heal":
      return "Mode: **heal** — **HEALED** rows above were retried automatically and the retry passed; **SUGGESTED** rows scored below the heal threshold and were never retried. No mode ever modifies your test source.";
    case "unknown":
      return null;
  }
}

function renderEmptyBody(): string {
  return [
    "## Eir report",
    "",
    "No heal-eligible activity this run — nothing for Eir to suggest.",
    "",
    "---",
    `playwright-eir · [how Eir scores a suggestion](${"{{DOCS_URL}}"})`,
    "",
    REPORT_MARKER,
  ].join("\n");
}

export function renderComment(input: RenderCommentInput): string {
  if (input.rows.length === 0) {
    return renderEmptyBody().replace("{{DOCS_URL}}", input.docsUrl);
  }

  // A3 (1.0.0 closure): a Playwright attempt CI retries re-runs Eir's
  // whole pipeline and appends its own row for the same selector — dedupe
  // before any downstream count or table, so both the headline numbers
  // and the table itself reflect unique selectors, not raw attempt counts.
  const deduped = dedupeReportRows(input.rows);

  const diffEntries = deduped.filter((entry) => hasDiff(entry.row));
  const asideEntries = deduped.filter((entry) => !hasDiff(entry.row));
  const screenshotCount = deduped.filter((entry) => entry.row.screenshotFile !== null).length;

  const routeCount = new Set(diffEntries.map((entry) => entry.row.route)).size;
  const suggestedCount = diffEntries.filter((entry) => entry.row.action === "suggested").length;
  const healedCount = diffEntries.filter((entry) => entry.row.action === "healed").length;
  const rejectedOrFailedCount = diffEntries.length - suggestedCount - healedCount;

  const summaryParts = [
    `${suggestedCount} suggested`,
    `${healedCount} healed`,
    ...(rejectedOrFailedCount > 0 ? [`${rejectedOrFailedCount} rejected on retry`] : []),
  ];

  const lines: string[] = [
    "## Eir report",
    "",
    `**${pluralize(routeCount, "route")} flagged** · ${summaryParts.join(", ")} this run.`,
    "",
    "> This reflects only what Eir intercepted and had a stored baseline for on this run — not a full audit of every selector on this PR. Drift outside what Eir's own tests exercise, or on selectors with no prior recorded baseline, won't appear here.",
    "",
  ];

  if (diffEntries.length > 0) {
    lines.push(
      "| Status | Route | Suggested diff | Confidence |",
      "|---|---|---|---|",
      ...diffEntries.map(
        ({ row, seenCount }) =>
          `| ${BADGE_BY_ACTION[row.action]}${llmMarker(row)} | \`${row.route}\` | ${diffCell(row)} | ${confidenceCell(row, seenCount)} |`,
      ),
      "",
    );
  }

  const fallbackRows = deduped.flatMap(({ row }) =>
    row.fallback === null ? [] : [{ row, fallback: row.fallback }],
  );
  if (fallbackRows.length > 0) {
    lines.push(
      "⚠ **LLM-assisted rows** — Eir's deterministic heuristics could not decide these (confidence or decision margin below the trust bars), so an LLM verdict was recorded *at suggestion strength only*: it can never retry an action, heal a test, or modify anything. An LLM opinion is less trustworthy than a heuristic score — verify these by hand before applying.",
      "",
      ...fallbackRows.map(({ row, fallback }) => {
        const detail = fallback.detail !== null && fallback.verdict !== "no-verdict" ? ` — ${fallback.detail}` : "";
        return `- \`${row.selectorKey}\` · ${fallback.provider}: **${fallback.verdict}**${detail}`;
      }),
      "",
    );
  }

  const verificationNote = renderVerificationNote(deduped.map((entry) => entry.row));
  if (verificationNote !== null) {
    lines.push(verificationNote, "");
  }

  if (asideEntries.length > 0) {
    lines.push(
      `Eir also logged ${pluralize(asideEntries.length, "other outcome")} with no actionable suggestion this run (no confident match, or a successful action that looked suspiciously unlike its own baseline) — see the local \`eir-report.md\` artifact for the full detail.`,
      "",
    );
  }

  if (screenshotCount > 0) {
    const linkText =
      input.screenshotArtifactUrl !== null
        ? `[this run's \`eir-report\` artifact](${input.screenshotArtifactUrl})`
        : "this run's `eir-report` artifact";
    lines.push(
      `${pluralize(screenshotCount, "screenshot")} of the matched element${screenshotCount === 1 ? "" : "s"} above ${screenshotCount === 1 ? "is" : "are"} in ${linkText} — not inlined here (GitHub strips \`data:\` image sources from comments, and Blueprint §6 rules out hosting them anywhere else).`,
      "",
    );
  }

  const modeLine = renderModeLine(input.mode);
  if (modeLine !== null) {
    lines.push(modeLine, "");
  }

  lines.push(
    "---",
    `playwright-eir · [how Eir scores a suggestion](${input.docsUrl}) · this comment updates in place on future pushes to this PR`,
    "",
    REPORT_MARKER,
  );

  return lines.join("\n");
}
