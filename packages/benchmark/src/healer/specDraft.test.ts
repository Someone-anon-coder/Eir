import { describe, expect, it } from "vitest";
import { materializeSpec, specFileName, type SpecDraft } from "./specDraft.js";
import { SPEC_DRAFTS, anchoredDraft, draftFor } from "./specDrafts.js";
import { ALL_MUTATION_TARGETS } from "../targets.js";
import { extractSpecFacts, normalizeText } from "./specFacts.js";
import { detectTamper } from "./tamper.js";

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

  it("every registry target has a draft", () => {
    expect(
      ALL_MUTATION_TARGETS.filter((t) => draftFor(t.id) === undefined).map((t) => t.id),
    ).toEqual([]);
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

describe("anchored variant", () => {
  const positional = SPEC_DRAFTS.filter((d) => anchoredDraft(d) !== undefined);

  it("exists only for the four positional rowOrder targets", () => {
    expect(positional.map((d) => d.targetId).sort()).toEqual([
      "sibling-reorder.devices.active.rowOrder.row1",
      "sibling-reorder.devices.active.rowOrder.row2",
      "sibling-reorder.devices.archived.rowOrder.row1",
      "sibling-reorder.devices.archived.rowOrder.row2",
    ]);
  });

  it.each(positional.map((d) => [d.targetId, d] as const))(
    "%s: keeps the action and every assertion matcher, adds only an identity anchor",
    (_id, draft) => {
      const anchored = anchoredDraft(draft);
      if (anchored === undefined) throw new Error("expected a variant");
      const before = extractSpecFacts(materializeSpec(draft));
      const after = extractSpecFacts(materializeSpec(anchored));
      expect(after.actionLocators).toEqual(before.actionLocators);
      // Every original assertion survives unchanged; exactly one is added.
      expect(after.assertions.slice(1)).toEqual(before.assertions);
      expect(after.assertions).toHaveLength(before.assertions.length + 1);
      // The harness's own tamper diff sees nothing wrong with the variant.
      expect(detectTamper(materializeSpec(draft), materializeSpec(anchored))).toEqual([]);
    },
  );

  it("draftFor with no variant returns the original, byte for byte", () => {
    expect(draftFor("sibling-reorder.devices.active.rowOrder.row2")).toBe(
      SPEC_DRAFTS.find((d) => d.targetId === "sibling-reorder.devices.active.rowOrder.row2"),
    );
  });
});
