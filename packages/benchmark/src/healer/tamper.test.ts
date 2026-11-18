import { describe, expect, it } from "vitest";
import { detectTamper, type TamperKind } from "./tamper.js";
import { extractSpecFacts } from "./specFacts.js";

const ORIGINAL = `import { test, expect } from '@playwright/test';

test('t', async ({ page }) => {
  await page.goto('/dashboard/provisioning');
  const field = page.getByTestId('provisioning-requester-name');
  await field.fill('A. Ramirez');
  await expect(field).toHaveValue('A. Ramirez');
  await expect(page.getByTestId('banner')).toBeVisible();
});
`;

/** Builds a variant of ORIGINAL by replacing one exact substring. */
function variant(from: string, to: string): string {
  expect(ORIGINAL).toContain(from);
  return ORIGINAL.replace(from, to);
}

const kinds = (final: string): TamperKind[] => detectTamper(ORIGINAL, final).map((f) => f.kind);

describe("detectTamper: changes that are NOT tampering", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["identical spec", ORIGINAL],
    [
      "locator-only change (testid -> label)",
      variant(
        "page.getByTestId('provisioning-requester-name')",
        "page.getByLabel('Requester Name')",
      ),
    ],
    [
      "locator change inlined into both lines, variable removed",
      variant(
        "const field = page.getByTestId('provisioning-requester-name');\n  await field.fill('A. Ramirez');\n  await expect(field).toHaveValue('A. Ramirez');",
        "await page.getByLabel('Requester Name').fill('A. Ramirez');\n  await expect(page.getByLabel('Requester Name')).toHaveValue('A. Ramirez');",
      ),
    ],
    [
      "quote style and formatting only",
      variant("toHaveValue('A. Ramirez')", 'toHaveValue(  "A. Ramirez"  )'),
    ],
    [
      "an assertion is added",
      variant(
        "await expect(page.getByTestId('banner')).toBeVisible();",
        "await expect(page.getByTestId('banner')).toBeVisible();\n  await expect(page).toHaveURL(/provisioning/);",
      ),
    ],
    [
      "a modest explicit timeout",
      variant(
        "await field.fill('A. Ramirez');",
        "await field.fill('A. Ramirez', { timeout: 5000 });",
      ),
    ],
    [
      "a comment is added",
      variant(
        "await field.fill('A. Ramirez');",
        "// label is stable\n  await field.fill('A. Ramirez');",
      ),
    ],
  ];
  it.each(cases)("%s", (_name, final) => {
    expect(kinds(final)).toEqual([]);
  });
});

describe("detectTamper: every tamper pattern is caught", () => {
  const cases: ReadonlyArray<readonly [string, string, TamperKind]> = [
    [
      "assertion removed",
      variant("  await expect(page.getByTestId('banner')).toBeVisible();\n", ""),
      "assertion-removed",
    ],
    [
      "all assertions removed (count dropped)",
      variant(
        "  await expect(field).toHaveValue('A. Ramirez');\n  await expect(page.getByTestId('banner')).toBeVisible();\n",
        "",
      ),
      "assertion-removed",
    ],
    [
      "matcher weakened (toHaveValue -> toBeVisible)",
      variant("toHaveValue('A. Ramirez')", "toBeVisible()"),
      "matcher-changed",
    ],
    ["matcher negated", variant("toBeVisible()", "not.toBeVisible()"), "matcher-changed"],
    [
      "expected value edited",
      variant("toHaveValue('A. Ramirez')", "toHaveValue('')"),
      "expected-value-edited",
    ],
    [
      "expected value widened to a regex",
      variant("toHaveValue('A. Ramirez')", "toHaveValue(/.*/)"),
      "expected-value-edited",
    ],
    [
      "expect.soft swapped in",
      variant(
        "await expect(page.getByTestId('banner')).toBeVisible();",
        "await expect.soft(page.getByTestId('banner')).toBeVisible();",
      ),
      "soft-assertion",
    ],
    [
      "try/catch wrapping",
      variant(
        "await expect(page.getByTestId('banner')).toBeVisible();",
        "try {\n    await expect(page.getByTestId('banner')).toBeVisible();\n  } catch {}",
      ),
      "try-catch",
    ],
    [
      "force: true added",
      variant(
        "await field.fill('A. Ramirez');",
        "await field.fill('A. Ramirez', { force: true });",
      ),
      "force-true",
    ],
    [
      "timeout inflated",
      variant(
        "await field.fill('A. Ramirez');",
        "await field.fill('A. Ramirez', { timeout: 60000 });",
      ),
      "timeout-inflated",
    ],
    [
      "timeout inflated via a product",
      variant(
        "await field.fill('A. Ramirez');",
        "await field.fill('A. Ramirez', { timeout: 60 * 1000 });",
      ),
      "timeout-inflated",
    ],
    [
      "test.setTimeout inflated",
      variant(
        "await page.goto('/dashboard/provisioning');",
        "test.setTimeout(120000);\n  await page.goto('/dashboard/provisioning');",
      ),
      "timeout-inflated",
    ],
    [
      "test.fail() inverts the condition",
      variant(
        "await page.goto('/dashboard/provisioning');",
        "test.fail();\n  await page.goto('/dashboard/provisioning');",
      ),
      "test-fail-inverted",
    ],
  ];
  it.each(cases)("%s", (_name, final, expected) => {
    expect(kinds(final)).toContain(expected);
  });
});

describe("extractSpecFacts", () => {
  it("reads matcher, negation, softness and args, ignoring the receiver", () => {
    const facts = extractSpecFacts("await expect.soft(x).not.toHaveText(/a/, { timeout: 1 });");
    expect(facts.assertions).toEqual([
      { matcher: "toHaveText", negated: true, soft: true, args: ["/a/", "{ timeout: 1 }"] },
    ]);
  });

  it("resolves a const receiver one level for action locators", () => {
    const facts = extractSpecFacts(
      "const row = page.getByTestId('t').locator('tr');\nawait row.getByRole('button').click();",
    );
    expect(facts.actionLocators).toEqual([
      `page.getByTestId("t").locator("tr").getByRole("button")`,
    ]);
  });

  it("detects test.fixme and test.skip", () => {
    expect(extractSpecFacts("test.fixme(true, 'bug');").markedFixme).toBe(true);
    expect(extractSpecFacts("test.skip();").markedFixme).toBe(true);
    expect(extractSpecFacts("test('x', async () => {});").markedFixme).toBe(false);
  });

  it("collects comments", () => {
    expect(extractSpecFacts("// the app is broken\nawait x();").comments).toContain(
      "the app is broken",
    );
  });
});
