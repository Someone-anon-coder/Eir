/**
 * Blueprint §7.1's exact interception surface, as data — the single source
 * of truth both the wrapper classes and their tests are written against.
 * Anything not listed here (on either `Locator` or `Page`) is a plain,
 * untouched pass-through (see NOTES.md RISK-004).
 */

export const IMPERATIVE_METHODS = [
  "click",
  "fill",
  "type",
  "press",
  "check",
  "uncheck",
  "selectOption",
  "hover",
  "waitFor",
  "innerText",
  "textContent",
] as const;

export type ImperativeMethod = (typeof IMPERATIVE_METHODS)[number];

export const INTERROGATIVE_METHODS = ["isVisible", "isEnabled", "isChecked", "count"] as const;

export type InterrogativeMethod = (typeof INTERROGATIVE_METHODS)[number];
