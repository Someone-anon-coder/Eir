import { describe, expect, it } from "vitest";
import { computeStability, majorityOutcome, normalizeLocator } from "./stability.js";

describe("normalizeLocator", () => {
  it.each([
    [`page.getByLabel('Requester Name')`, `page.getByLabel("Requester Name")`],
    [`page.getByLabel("Requester Name");`, `page.getByLabel("Requester Name")`],
    [
      `page\n    .getByRole('button', {name:'Edit'})`,
      `page.getByRole("button", {name:"Edit"})`.replace("{name", "{name"),
    ],
  ])("%s", (input, expected) => {
    expect(normalizeLocator(input)).toBe(normalizeLocator(expected));
  });
});

describe("computeStability", () => {
  const run = (outcome: string, finalLocator?: string) => ({ outcome, finalLocator });
  const cases: ReadonlyArray<readonly [string, ReturnType<typeof run>[], boolean, boolean]> = [
    [
      "identical outcomes and locators",
      [
        run("healed-correct", "page.getByLabel('A')"),
        run("healed-correct", `page.getByLabel("A")`),
        run("healed-correct", "page.getByLabel('A');"),
      ],
      true,
      true,
    ],
    [
      "same outcome, different locators",
      [
        run("healed-correct", "page.getByLabel('A')"),
        run("healed-correct", "page.getByRole('textbox')"),
      ],
      true,
      false,
    ],
    [
      "different outcomes, same locator",
      [run("healed-correct", "x"), run("tampered-green", "x")],
      false,
      true,
    ],
    [
      "a run with no readable locator is its own value",
      [run("still-failing"), run("still-failing", "x")],
      true,
      false,
    ],
    ["single run is trivially stable", [run("fixme", "x")], true, true],
  ];
  it.each(cases)("%s", (_name, runs, outcomesMatch, locatorsMatch) => {
    const s = computeStability(runs);
    expect(s.outcomesMatch).toBe(outcomesMatch);
    expect(s.locatorsMatch).toBe(locatorsMatch);
    expect(s.runs).toBe(runs.length);
  });
});

describe("majorityOutcome", () => {
  it.each([
    [["a", "a", "b"], "a"],
    [["a", "a", "a"], "a"],
    [["a", "b", "c"], "no-majority"],
    [["a", "b"], "no-majority"],
    [["a"], "a"],
    [[], "no-runs"],
  ])("%j -> %s", (outcomes, expected) => {
    expect(majorityOutcome(outcomes)).toBe(expected);
  });
});
