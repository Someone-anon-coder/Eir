import { describe, expect, it } from "vitest";
import { materializeSpec, specFileName, type SpecDraft } from "./specDraft.js";
import { SPEC_DRAFTS, draftFor } from "./specDrafts.js";
import { ALL_MUTATION_TARGETS } from "../targets.js";
import { extractSpecFacts, normalizeText } from "./specFacts.js";

const sessionDraft: SpecDraft = {
  targetId: "id-rename.account.openDeleteButton",
  mutationClass: "id-rename",
  element: "account.openDeleteButton",
  route: "/dashboard/account",
  auth: "session",
  body: ["await page.getByTestId('open-delete-account').click();"],
  expectation: "heal",
};

describe("materializeSpec", () => {
  it("authenticates through sessionStorage, never the UI, then navigates", () => {
    expect(materializeSpec(sessionDraft)).toBe(
      [
        "import { test, expect } from '@playwright/test';",
        "",
        "test('id-rename.account.openDeleteButton', async ({ page }) => {",
        "  await page.goto('/login');",
        "  await page.evaluate(() => sessionStorage.setItem('ward_auth', '1'));",
        "  await page.goto('/dashboard/account');",
        "  await page.getByTestId('open-delete-account').click();",
        "});",
        "",
      ].join("\n"),
    );
  });

  it("login targets skip auth: logging in is the thing under test", () => {
    const text = materializeSpec({ ...sessionDraft, auth: "none", route: "/login" });
    expect(text).not.toContain("sessionStorage");
    expect(text).toContain("await page.goto('/login');");
  });

  it.each([
    ["id-rename.login.usernameInputId", "id-rename.login.usernameInputId.spec.ts"],
    ["near-dup.table-row.active", "near-dup.table-row.active.spec.ts"],
    ["weird/id with spaces", "weird_id_with_spaces.spec.ts"],
  ])("specFileName(%s)", (id, expected) => {
    expect(specFileName(id)).toBe(expected);
  });
});

describe("spec drafts", () => {
  it("target ids are unique", () => {
    const ids = SPEC_DRAFTS.map((d) => d.targetId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(SPEC_DRAFTS.map((d) => [d.targetId, d] as const))(
    "%s has an interaction and a post-condition",
    (_id, draft) => {
      expect(draft.body.some((line) => line.includes("expect("))).toBe(true);
      expect(draft.body.length).toBeGreaterThanOrEqual(2);
    },
  );

  it("only login targets and the empty-password regression skip session auth", () => {
    const noAuth = SPEC_DRAFTS.filter((d) => d.auth === "none").map((d) => d.targetId);
    expect(noAuth.every((id) => id.includes(".login."))).toBe(true);
  });

  it("every pilot-class registry target has a draft", () => {
    const pilot = ALL_MUTATION_TARGETS.filter(
      (t) => t.mutationClass === "id-rename" || t.mutationClass === "near-duplicate-sibling-swap",
    );
    expect(pilot.filter((t) => draftFor(t.id) === undefined).map((t) => t.id)).toEqual([]);
  });

  it("near-duplicate drafts name a decoy that differs from the target element", () => {
    for (const d of SPEC_DRAFTS.filter((x) => x.mutationClass === "near-duplicate-sibling-swap")) {
      expect(d.decoyElement).toBeDefined();
      expect(d.decoyElement).not.toBe(d.element);
    }
  });

  it("real-regression drafts expect stay-red, every other kind expects heal", () => {
    for (const d of SPEC_DRAFTS) {
      expect(d.expectation).toBe(d.mutationClass === "real-regression" ? "stay-red" : "heal");
    }
  });

  it.each(SPEC_DRAFTS.map((d) => [d.targetId, d] as const))(
    "%s: no assertion re-resolves the locator the first action used",
    (_id, draft) => {
      const text = materializeSpec(draft);
      const [actedThrough] = extractSpecFacts(text).actionLocators;
      // Login specs act through a CSS id and assert on the URL; nothing to compare.
      if (actedThrough === undefined) return;
      const assertionLines = text
        .split("\n")
        .filter((line) => line.includes("expect("))
        .map(normalizeText);
      for (const line of assertionLines) {
        expect(line).not.toContain(actedThrough);
      }
    },
  );
});
