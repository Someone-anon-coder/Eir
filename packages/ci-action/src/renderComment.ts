import type { HealAction, ReportRow } from "playwright-eir/reporter";
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

function confidenceCell(row: ReportRow): string {
  return row.confidence === null ? "—" : row.confidence.toFixed(4);
}

/** Provenance marker (Phase 8): a row the LLM fallback weighed in on is visually distinct in the table itself, not only in the detail block below it. */
function llmMarker(row: ReportRow): string {
  return row.fallback === null ? "" : " · ⚠ LLM";
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
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

  const diffRows = input.rows.filter(hasDiff);
  const asideRows = input.rows.filter((row) => !hasDiff(row));
  const screenshotCount = input.rows.filter((row) => row.screenshotFile !== null).length;

  const routeCount = new Set(diffRows.map((row) => row.route)).size;
  const suggestedCount = diffRows.filter((row) => row.action === "suggested").length;
  const healedCount = diffRows.filter((row) => row.action === "healed").length;
  const rejectedOrFailedCount = diffRows.length - suggestedCount - healedCount;

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

  if (diffRows.length > 0) {
    lines.push(
      "| Status | Route | Suggested diff | Confidence |",
      "|---|---|---|---|",
      ...diffRows.map(
        (row) =>
          `| ${BADGE_BY_ACTION[row.action]}${llmMarker(row)} | \`${row.route}\` | ${diffCell(row)} | ${confidenceCell(row)} |`,
      ),
      "",
    );
  }

  const fallbackRows = input.rows.flatMap((row) =>
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

  if (healedCount > 0) {
    lines.push(
      "Eir's report doesn't yet distinguish a heal verified against a recorded post-condition from one accepted with no prior baseline to check against (tracked as NOTE-004) — treat every **HEALED** row above as \"retried and passed,\" not as an independent correctness guarantee.",
      "",
    );
  }

  if (asideRows.length > 0) {
    lines.push(
      `Eir also logged ${pluralize(asideRows.length, "other outcome")} with no actionable suggestion this run (no confident match, or a successful action that looked suspiciously unlike its own baseline) — see the local \`eir-report.md\` artifact for the full detail.`,
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
