/**
 * The fixed allow-list from docs/fingerprint-schema.md. Only these keys
 * (plus any `aria-*`) survive from the raw, unfiltered attribute dump
 * rawExtract.ts returns — everything else (class, style, href, src, other
 * data-* attributes) is dropped by decision, not oversight.
 */

const ALLOWED_ATTRS: ReadonlySet<string> = new Set(["id", "name", "type", "data-testid", "role"]);

export function filterAttrs(rawAttrs: Readonly<Record<string, string>>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawAttrs)) {
    if (ALLOWED_ATTRS.has(key) || key.startsWith("aria-")) {
      result[key] = value;
    }
  }
  return result;
}
