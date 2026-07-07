/**
 * The taxonomy (Blueprint §7.8 + NOTE-002's formal adoption this phase).
 * `compound-release` mixes 2-3 of the first six; `near-duplicate-sibling-swap`
 * is its own class, kept separate from the compound mix since its ground
 * truth shape (a recorded distractor) differs from the other six.
 */
export const MUTATION_CLASSES = [
  "id-rename",
  "text-change",
  "tag-swap",
  "class-shuffle",
  "sibling-reorder",
  "wrapper-inject",
  "near-duplicate-sibling-swap",
  "compound-release",
] as const;

export type MutationClass = (typeof MUTATION_CLASSES)[number];

export function isMutationClass(value: string): value is MutationClass {
  return (MUTATION_CLASSES as readonly string[]).includes(value);
}
