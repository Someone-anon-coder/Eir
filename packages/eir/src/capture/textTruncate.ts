/**
 * Shared truncation rule for `text` and `label` (docs/fingerprint-schema.md):
 * whitespace-collapsed, trimmed, hard-cut at 100 chars with a trailing `…`
 * marker for diff-readability. Empty-after-trim collapses to `null` — no
 * text is a real state, not a capture failure.
 */

export const TEXT_TRUNCATE_LIMIT = 100;

export function truncateText(raw: string, limit: number = TEXT_TRUNCATE_LIMIT): string | null {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (collapsed.length === 0) return null;
  if (collapsed.length <= limit) return collapsed;
  return `${collapsed.slice(0, limit)}…`;
}
