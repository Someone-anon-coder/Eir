/**
 * Security review 1.0 (docs/security-review-1.0.md, injection surfaces):
 * every string embedded in the rendered PR comment — `route`,
 * `selectorKey`, `suggestion`, an LLM fallback's `detail` — ultimately
 * traces back to live page content (attribute values, text) that
 * `playwright-eir` captured from the page under test. A hostile or
 * compromised page can put arbitrary characters into a `data-testid`,
 * `aria-label`, or visible text, and Eir's suggestion generator will
 * faithfully reproduce them.
 *
 * Confirmed via a real hostile fixture (not assumed) that embedding these
 * raw broke the rendered comment three ways:
 *   - a backtick closes the surrounding inline-code span early, so
 *     everything after it renders as raw markdown/HTML instead of
 *     literal text;
 *   - a pipe fragments the GFM table row into extra, fabricated cells;
 *   - a literal newline ends the table row entirely, letting arbitrary
 *     free-form content escape into the comment body.
 *
 * `sanitizeForMarkdownCell` neutralizes all three, plus HTML-escapes
 * `<`/`>`/`&` so embedded HTML-looking text renders as literal text
 * rather than being parsed as markup at all (defense in depth — GitHub's
 * own sanitizer already strips genuinely dangerous tags, but this keeps
 * the *rendered content* honest rather than relying solely on GitHub's
 * sanitizer as the only backstop). Order matters: `&` must be escaped
 * first, or escaping `<`/`>` afterward would double-escape their own
 * entities.
 */
export function sanitizeForMarkdownCell(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/`/g, "｀") // fullwidth backtick — visually similar, can't close a code span
    .replace(/\|/g, "\\|")
    .replace(/\r\n|\r|\n/g, " "); // never let embedded content break a row out of the table
}
