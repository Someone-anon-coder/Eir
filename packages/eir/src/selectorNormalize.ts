/**
 * Selector normalization (Blueprint §7.3, the f-string lesson): a text
 * literal *embedded inside a hand-constructed selector string* (the XPath
 * `normalize-space()='Monthly'` case, via `locator()`) becomes `{TEXT}` so
 * per-value variants of the *same* constructed string share one
 * fingerprint entry, with the literal kept alongside as an instance param.
 * This is the only templating this module does.
 *
 * Every other method's own literal argument — `getByText`/`getByLabel`/
 * `getByPlaceholder`'s text, `getByRole`'s `options.name`, `getByTestId`'s
 * id — is left exactly as captured, never templated. A wrapper only ever
 * sees `{ method, args }`, with no way to tell "this literal varies because
 * of test parameterization" from "this is simply a different, distinct
 * selector that happens to use the same method." Templating either of them
 * was tried and discarded during Phase 3: it collapsed real, different,
 * static selectors on the same route (`getByLabel("Requested By")` vs
 * `getByLabel("Duration")`; four distinct `getByRole("link", {name})` nav
 * links down to one) into a single key, silently overwriting one
 * fingerprint with another — the opposite of the fragmentation problem
 * templating was meant to solve. `RegExp` args are already pattern-like
 * (not a single instance value) and are left as-is wherever they appear.
 */

import type { ChainHop, CapturePointMethod } from "./selectorIdentity.js";

const XPATH_TEXT_LITERAL_PATTERNS: readonly RegExp[] = [
  /(normalize-space\(\)\s*=\s*)(['"])(.*?)\2/g,
  /(text\(\)\s*=\s*)(['"])(.*?)\2/g,
  /(contains\(\s*text\(\)\s*,\s*)(['"])(.*?)\2/g,
];

export interface NormalizedSelector {
  readonly key: string;
  readonly instanceParams: readonly string[];
}

function normalizeXpathTextLiterals(selector: string, instances: string[]): string {
  let result = selector;
  for (const pattern of XPATH_TEXT_LITERAL_PATTERNS) {
    result = result.replace(pattern, (_match, prefix: string, quote: string, literal: string) => {
      instances.push(literal);
      return `${prefix}${quote}{TEXT}${quote}`;
    });
  }
  return result;
}

function sortKeys(value: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = value[key];
  }
  return sorted;
}

function stableStringifyArg(arg: unknown): string {
  if (arg instanceof RegExp) return arg.toString();
  if (typeof arg === "object" && arg !== null && !Array.isArray(arg)) {
    return JSON.stringify(sortKeys(arg as Record<string, unknown>));
  }
  return JSON.stringify(arg);
}

function normalizeHopArgs(
  method: CapturePointMethod,
  args: readonly unknown[],
): { readonly normalizedArgs: readonly unknown[]; readonly instances: readonly string[] } {
  const instances: string[] = [];

  const normalizedArgs = args.map((arg, index) => {
    if (method === "locator" && index === 0 && typeof arg === "string") {
      return normalizeXpathTextLiterals(arg, instances);
    }
    return arg;
  });

  return { normalizedArgs, instances };
}

export function normalizeSelector(chainPath: readonly ChainHop[]): NormalizedSelector {
  const instanceParams: string[] = [];

  const hopStrings = chainPath.map((hop) => {
    const { normalizedArgs, instances } = normalizeHopArgs(hop.method, hop.args);
    instanceParams.push(...instances);
    return `${hop.method}(${normalizedArgs.map(stableStringifyArg).join(", ")})`;
  });

  return { key: hopStrings.join(" > "), instanceParams };
}
