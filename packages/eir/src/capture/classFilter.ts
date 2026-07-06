/**
 * The Tailwind-noise filter from docs/fingerprint-schema.md, as a plain,
 * readable, amendable regex list — the single source of truth (the in-page
 * rawExtract.ts deliberately does NOT duplicate this; see the Phase 3
 * capture-script Understanding Gate). Each pattern is anchored so it can't
 * false-positive on a salient class that merely starts with a utility-like
 * prefix (e.g. "bordercollapse" is not "border").
 */

const UTILITY_CLASS_PATTERNS: readonly RegExp[] = [
  /^(flex|grid|block|inline|hidden|contents)$/,
  /^(inline-block|inline-flex|inline-grid|table|table-cell|table-row)$/,
  /^(absolute|relative|fixed|sticky|static)$/,
  /^(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y)-/,
  /^(w|h|min-w|min-h|max-w|max-h)-/,
  /^(text|bg|border|rounded|shadow|opacity|z|top|bottom|left|right|font|leading|tracking|divide|ring|outline|from|via|to)(-|$)/,
  /^(items|justify|content|self|place)-/,
  /^(overflow|cursor|transition|duration|ease|animate|scale|rotate|translate|skew)(-|$)/,
  /^(sr-only|not-sr-only|truncate|antialiased)$/,
  /^(hover|focus|active|disabled|visited|group-hover|peer-focus|first|last|odd|even):/,
  /^(sm|md|lg|xl|2xl|dark):/,
];

export function isUtilityClass(token: string): boolean {
  return UTILITY_CLASS_PATTERNS.some((pattern) => pattern.test(token));
}

export function filterClasses(rawClasses: readonly string[]): string[] {
  return rawClasses.filter((token) => !isUtilityClass(token));
}
