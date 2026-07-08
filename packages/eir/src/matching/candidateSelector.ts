/**
 * Node-side half of candidate generation (Blueprint §7.5 stage 1, §7.2's
 * tag field docs): expands a fingerprint's tag into a CSS selector
 * covering it plus known tag-swap equivalents, so the in-page extractor
 * (`candidateExtract.ts`) can run one `querySelectorAll` instead of
 * needing this mapping duplicated in browser code too.
 *
 * The swap family (Blueprint: `button ↔ a ↔ input[type=submit]`) is
 * narrower than "any input" — discovered live via a real benchmark run:
 * treating every `<input>` as swap-equivalent to buttons expanded a
 * plain `input[type=text]`'s candidate query to
 * `"button, a, input[type=submit], input[type=button]"`, which a text
 * input never itself matches. The renamed field was silently absent from
 * its own candidate pool — the matcher wasn't choosing badly, it was
 * choosing from a pool that never contained the right answer. Only an
 * input whose *own* type is already submit/button joins the button
 * family; every other input type (text, password, email, checkbox, the
 * near-dup wizard fields, …) searches its own tag broadly instead,
 * exactly like any non-swappable tag.
 */

const BUTTON_LIKE_GROUP: readonly string[] = [
  "button",
  "a",
  "input[type=submit]",
  "input[type=button]",
];
const BUTTON_LIKE_TAGS: ReadonlySet<string> = new Set(["button", "a"]);
const BUTTON_LIKE_INPUT_TYPES: ReadonlySet<string> = new Set(["submit", "button"]);

export function candidateSelector(tag: string, type: string | undefined): string {
  if (BUTTON_LIKE_TAGS.has(tag)) {
    return BUTTON_LIKE_GROUP.join(", ");
  }
  if (tag === "input" && type !== undefined && BUTTON_LIKE_INPUT_TYPES.has(type)) {
    return BUTTON_LIKE_GROUP.join(", ");
  }
  return tag;
}
