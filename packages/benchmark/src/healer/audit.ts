import { extractSpecFacts } from "./specFacts.js";

/** How the original spec's action picks its row: by where it sits, or by what it is. */
export function actionIdentity(originalSpec: string): "position only" | "name and table" | "other" {
  const [locator] = extractSpecFacts(originalSpec).actionLocators;
  if (locator === undefined) return "other";
  if (/hasText/.test(locator)) return "name and table";
  if (/nth-child\(\d+\)/.test(locator)) return "position only";
  return "other";
}

export interface ReceiverChange {
  readonly changed: boolean;
  readonly original: readonly string[];
  readonly final: readonly string[];
}

/** Did the healer change the expression an assertion is evaluated on? The tamper diff cannot see this. */
export function receiverChange(originalSpec: string, finalSpec: string): ReceiverChange {
  const original = extractSpecFacts(originalSpec).assertions.map((a) => a.receiver);
  const final = extractSpecFacts(finalSpec).assertions.map((a) => a.receiver);
  return { changed: JSON.stringify(original) !== JSON.stringify(final), original, final };
}

/** Text the healer anchored on: the literals in `hasText:` and `name:` options of the final spec. */
export function anchorLiterals(finalSpec: string): string[] {
  const out = new Set<string>();
  for (const m of finalSpec.matchAll(
    /(?:hasText|name):\s*(?:(['"])((?:(?!\1).)*)\1|\/((?:\\\/|[^/])+)\/)/g,
  )) {
    const text = m[2] ?? m[3];
    if (text !== undefined) out.add(text.replace(/\\\./g, ".").replace(/\\/g, ""));
  }
  return [...out];
}

export interface AnchorProvenance {
  readonly text: string;
  /** Present in the original spec as test data. */
  readonly inOriginalSpec: boolean;
  /** Present in Ward's page data (searched in the supplied source text). */
  readonly inPageData: boolean;
}

export function anchorProvenance(
  finalSpec: string,
  originalSpec: string,
  pageDataSource: string,
): AnchorProvenance[] {
  return anchorLiterals(finalSpec).map((text) => ({
    text,
    inOriginalSpec: originalSpec.includes(text),
    inPageData: pageDataSource.includes(text),
  }));
}

/** Every comment line of a spec, verbatim, plus the line that marks it `fixme`/`skip`. */
export function commentAndFixmeLines(spec: string): string[] {
  return spec
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.startsWith("//") ||
        l.startsWith("/*") ||
        l.startsWith("*") ||
        /test\.(fixme|skip)\(/.test(l),
    );
}
