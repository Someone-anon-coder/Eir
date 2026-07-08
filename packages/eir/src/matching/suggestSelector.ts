import type { Locator, Page } from "@playwright/test";
import type { CapturedCandidate } from "./captureCandidates.js";

/**
 * Suggested-selector generator (Blueprint §5.3, closing §10.6): a heal is
 * a matched element *plus* a freshly generated replacement selector, built
 * in robustness preference order — `data-testid > id > role+accessible-
 * name > label association > structural path` — and verified unique
 * against the live DOM before being offered. A suggestion that resolves to
 * more than one element, or to the *wrong* element, is worse than no
 * suggestion at all.
 */

export type SuggestedSelectorKind = "data-testid" | "id" | "role" | "label" | "structural";

export interface SuggestedSelector {
  readonly kind: SuggestedSelectorKind;
  /** Human-readable, Playwright-idiomatic replacement selector text (e.g. `getByTestId("x")`). */
  readonly description: string;
}

type AriaRole = NonNullable<Parameters<Page["getByRole"]>[0]>;

const IMPLIED_ROLE_BY_TAG: Readonly<Record<string, AriaRole>> = {
  button: "button",
  a: "link",
};

/** Native semantic HTML gives most of Ward's elements an *implicit* role Playwright's `getByRole` already understands, even with no explicit `role=` attribute captured. */
function impliedRole(tag: string, attrs: Readonly<Record<string, string>>): AriaRole | undefined {
  const explicit = attrs["role"];
  if (explicit !== undefined) {
    // Free-text captured attribute value, not validated against the real
    // AriaRole union at capture time — an invalid value here just makes
    // this one candidate fail its own resolution check below and falls
    // through to the next preference tier, so a bad cast can't produce a
    // wrong suggestion, only a skipped one.
    return explicit as AriaRole;
  }
  if (tag === "input" && (attrs["type"] === "submit" || attrs["type"] === "button")) return "button";
  return IMPLIED_ROLE_BY_TAG[tag];
}

interface SuggestionCandidate {
  readonly kind: SuggestedSelectorKind;
  readonly description: string;
  readonly locator: (page: Page) => Locator;
}

function candidatesInPreferenceOrder(target: CapturedCandidate): readonly SuggestionCandidate[] {
  const { features } = target;
  const candidates: SuggestionCandidate[] = [];

  const testId = features.attrs["data-testid"];
  if (testId !== undefined) {
    candidates.push({
      kind: "data-testid",
      description: `getByTestId(${JSON.stringify(testId)})`,
      locator: (page) => page.getByTestId(testId),
    });
  }

  const id = features.attrs["id"];
  if (id !== undefined) {
    candidates.push({
      kind: "id",
      description: `locator('[id="${id}"]')`,
      locator: (page) => page.locator(`[id="${id}"]`),
    });
  }

  const role = impliedRole(features.tag, features.attrs);
  if (role !== undefined && features.text !== null) {
    const name = features.text;
    candidates.push({
      kind: "role",
      description: `getByRole(${JSON.stringify(role)}, { name: ${JSON.stringify(name)}, exact: true })`,
      locator: (page) => page.getByRole(role, { name, exact: true }),
    });
  }

  if (features.label !== null) {
    const label = features.label;
    candidates.push({
      kind: "label",
      description: `getByLabel(${JSON.stringify(label)})`,
      locator: (page) => page.getByLabel(label),
    });
  }

  // Always available, always unique by construction — the exact query that
  // identified `target` in the first place. Last resort, never first
  // choice: a structural path is the most brittle kind of selector, which
  // is precisely why it sits at the bottom of the preference order.
  candidates.push({
    kind: "structural",
    description: `locator(${JSON.stringify(target.selector)}).nth(${target.domIndex})`,
    locator: (page) => page.locator(target.selector).nth(target.domIndex),
  });

  return candidates;
}

async function resolvesToTargetElement(
  page: Page,
  candidateLocator: Locator,
  target: CapturedCandidate,
): Promise<boolean> {
  const count = await candidateLocator.count();
  if (count !== 1) return false;

  const targetLocator = page.locator(target.selector).nth(target.domIndex);
  const targetHandle = await targetLocator.elementHandle().catch(() => null);
  const candidateHandle = await candidateLocator.elementHandle().catch(() => null);
  if (targetHandle === null || candidateHandle === null) return false;

  try {
    return await targetHandle.evaluate((el, other) => el === other, candidateHandle);
  } finally {
    await Promise.all([targetHandle.dispose(), candidateHandle.dispose()]);
  }
}

/**
 * Returns the first preference-ordered candidate that is both unique and
 * verified to resolve to the actual matched element — never a selector
 * that merely *looks* robust. Only ever returns `null` if even the
 * structural fallback fails (e.g. the page navigated away between
 * matching and suggesting), which fire-and-forget capture already treats
 * as a normal, silent miss elsewhere in this codebase.
 */
export async function suggestSelector(
  page: Page,
  target: CapturedCandidate,
): Promise<SuggestedSelector | null> {
  for (const candidate of candidatesInPreferenceOrder(target)) {
    try {
      const locator = candidate.locator(page);
      if (await resolvesToTargetElement(page, locator, target)) {
        return { kind: candidate.kind, description: candidate.description };
      }
    } catch {
      continue;
    }
  }
  return null;
}
