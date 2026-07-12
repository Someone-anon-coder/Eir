/**
 * Gate 1's upsert mechanism (session Understanding Gate, 2026-07-12):
 * every comment this action posts carries this exact, invisible marker.
 * Before posting, the action lists existing PR comments and searches for
 * one whose body contains it — found means "edit in place," not found
 * means "first comment on this PR." An HTML comment renders as nothing on
 * GitHub but survives byte-for-byte in the raw body, so the match is an
 * exact string search, never a heuristic guess at "which comment looks
 * like mine."
 *
 * Typed as a template literal type (versioned) rather than a bare
 * `string` so a future format change is forced to bump the version
 * consciously — see the Post-Phase TS Tip for why this is more than
 * decoration.
 */
export type EirMarker = `<!-- eir-report:v${number} -->`;

export const REPORT_MARKER: EirMarker = "<!-- eir-report:v1 -->";

export function bodyHasMarker(body: string, marker: EirMarker = REPORT_MARKER): boolean {
  return body.includes(marker);
}
