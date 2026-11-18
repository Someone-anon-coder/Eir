import { describe, expect, it } from "vitest";
import {
  actionIdentity,
  anchorLiterals,
  anchorProvenance,
  commentAndFixmeLines,
  receiverChange,
} from "./audit.js";

const POSITIONAL = `test('t', async ({ page }) => {
  await page.locator('[data-testid="table-archived-devices"] tbody tr:nth-child(2)').getByTestId('device-row-edit').click();
  await expect(page.getByTestId('table-archived-devices').locator('tr', { hasText: 'K. Nguyen' }).getByRole('textbox')).toBeVisible();
});`;
const NAMED = `test('t', async ({ page }) => {
  await page.getByTestId('table-active-devices').locator('tr', { hasText: 'K. Nguyen' }).locator('td:nth-child(5) button:first-child').click();
});`;

describe("actionIdentity", () => {
  it.each([
    ["a positional action", POSITIONAL, "position only"],
    [
      "an action that names the row (and uses :first-child only for the button)",
      NAMED,
      "name and table",
    ],
    ["no recognizable action", "await page.goto('/x');", "other"],
  ])("%s", (_n, spec, expected) => {
    expect(actionIdentity(spec)).toBe(expected);
  });
});

describe("receiverChange", () => {
  it("is false for a locator-only fix that keeps assertions' receivers", () => {
    expect(receiverChange(POSITIONAL, POSITIONAL).changed).toBe(false);
  });
  it("is true when the row text inside an assertion's locator was edited", () => {
    const r = receiverChange(POSITIONAL, POSITIONAL.replace("K. Nguyen", "A. Ramirez"));
    expect(r.changed).toBe(true);
    expect(r.final[0]).toContain("A. Ramirez");
  });
});

describe("anchors", () => {
  const FINAL = POSITIONAL.replace("K. Nguyen", "A. Ramirez");
  it("extracts hasText and name literals, quote styles and regexes", () => {
    const text =
      "x.locator('tr', { hasText: 'A. Ramirez' }); y.getByRole('button', { name: /M\\. Alvarez/ }); z.getByRole('row', { name: \"Edit\" })";
    expect(anchorLiterals(text)).toEqual(["A. Ramirez", "M. Alvarez", "Edit"]);
  });
  it("says where an anchor came from: the original spec, the page data, both or neither", () => {
    const p = anchorProvenance(FINAL, POSITIONAL, "owner: 'A. Ramirez', owner: 'K. Nguyen'");
    expect(p).toEqual([{ text: "A. Ramirez", inOriginalSpec: false, inPageData: true }]);
    const q = anchorProvenance(POSITIONAL, POSITIONAL, "nothing here");
    expect(q).toEqual([{ text: "K. Nguyen", inOriginalSpec: true, inPageData: false }]);
  });
});

describe("commentAndFixmeLines", () => {
  it("returns comments verbatim and the fixme marker", () => {
    const spec = "// FIXME: bug\n  // second line\ntest.fixme();\nawait x();";
    expect(commentAndFixmeLines(spec)).toEqual([
      "// FIXME: bug",
      "// second line",
      "test.fixme();",
    ]);
  });
});
