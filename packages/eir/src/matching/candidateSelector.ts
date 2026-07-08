/**
 * Node-side half of candidate generation (Blueprint §7.5 stage 1, §7.2's
 * tag field docs): expands a fingerprint's tag into a CSS selector
 * covering it plus known tag-swap equivalents, so the in-page extractor
 * (`candidateExtract.ts`) can run one `querySelectorAll` instead of
 * needing this mapping duplicated in browser code too.
 */

const TAG_SWAP_GROUP: readonly string[] = ["button", "a", "input[type=submit]", "input[type=button]"];
const TAG_SWAP_MEMBERS: ReadonlySet<string> = new Set(["button", "a", "input"]);

export function candidateSelector(tag: string): string {
  if (TAG_SWAP_MEMBERS.has(tag)) {
    return TAG_SWAP_GROUP.join(", ");
  }
  return tag;
}
