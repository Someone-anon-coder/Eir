/**
 * Recursively sorts object keys before stringifying, so the only thing
 * that ever shows up in a `git diff` of `.eir/routes/*.json` is an actual
 * content change — never insertion-order noise (Blueprint §7.3).
 * Array element order is left alone: it's meaningful (ancestor hop order,
 * class-token order), only object *key* order is normalized.
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);

  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  return value;
}

export function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortKeysDeep(value), null, 2)}\n`;
}
