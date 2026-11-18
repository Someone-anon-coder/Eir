/**
 * The healer comparison gives each tool the same breakage, so each target
 * needs a standalone vanilla `@playwright/test` spec the healer can edit.
 * `probe.spec.ts` generates its tests in a loop and cannot be edited
 * meaningfully, so this module turns an explicit per-target draft into spec
 * text. The draft is data, not a closure: spec text has to be written down.
 */

export const HEALER_CLASSES = [
  "id-rename",
  "text-change",
  "tag-swap",
  "class-shuffle",
  "sibling-reorder",
  "wrapper-inject",
  "near-duplicate-sibling-swap",
  "compound-release",
  "real-regression",
  "flow-change",
] as const;

export type HealerClass = (typeof HEALER_CLASSES)[number];

export function isHealerClass(value: string): value is HealerClass {
  return (HEALER_CLASSES as readonly string[]).includes(value);
}

/**
 * What a correct tool does with this target. `heal`: recover the original
 * intent. `stay-red`: the app is genuinely broken, so any green result is a
 * false green whatever element it acted on.
 */
export type Expectation = "heal" | "stay-red";

export interface SpecDraft {
  readonly targetId: string;
  /** The class the target belongs to; compound-release reuses its sources' drafts. */
  readonly mutationClass: HealerClass;
  /** Ground-truth element key (`data-eir-gt` value) the target step must act on. */
  readonly element: string;
  /** near-duplicate twin's element key: acting on it is a false heal. */
  readonly decoyElement?: string;
  /**
   * How the judge attributes an action to a marked element. `nearest`: the
   * innermost marked element under the event (the default). `path`: any marked
   * ancestor counts, for container targets, because a click on a container
   * lands on whichever descendant sits at its centre. `path` is weaker
   * evidence (a fix that selects a descendant still contains the target in
   * its path) and the docs say so.
   */
  readonly actedBy?: "nearest" | "path";
  readonly route: string;
  /** `none` only for `login.*` targets, where logging in is the thing under test. */
  readonly auth: "session" | "none";
  /** Statements after navigation: the frozen-selector interaction plus the post-condition. */
  readonly body: readonly string[];
  readonly expectation: Expectation;
}

const AUTH_STORAGE_KEY = "ward_auth";

function indent(lines: readonly string[]): string {
  return lines.map((line) => `  ${line}`).join("\n");
}

/** Setup never touches a mutated element: auth is a sessionStorage write, not a UI login. */
export function materializeSpec(draft: SpecDraft): string {
  const setup =
    draft.auth === "session"
      ? [
          "await page.goto('/login');",
          `await page.evaluate(() => sessionStorage.setItem('${AUTH_STORAGE_KEY}', '1'));`,
          `await page.goto('${draft.route}');`,
        ]
      : [`await page.goto('${draft.route}');`];
  return [
    "import { test, expect } from '@playwright/test';",
    "",
    `test('${draft.targetId}', async ({ page }) => {`,
    indent([...setup, ...draft.body]),
    "});",
    "",
  ].join("\n");
}

export function specFileName(targetId: string): string {
  return `${targetId.replace(/[^A-Za-z0-9._-]/g, "_")}.spec.ts`;
}
