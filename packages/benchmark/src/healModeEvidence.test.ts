import { describe, expect, it } from "vitest";
import { renderHealModeEvidenceMarkdown, type HealModeEvidenceResult } from "./healModeEvidence.js";

describe("renderHealModeEvidenceMarkdown", () => {
  it("summarizes a healed target with its retry outcome, confidence, and margin", () => {
    const evidence: HealModeEvidenceResult = {
      mutationClass: "near-duplicate-sibling-swap",
      seed: 42,
      generatedAt: "2026-07-11T00:00:00.000Z",
      results: [
        {
          targetId: "near-dup.wizardFields.title",
          passed: true,
          errorMessage: undefined,
          matchAttempt: undefined,
          distractorBBox: undefined,
          policyEvents: [
            {
              kind: "heal-attempt",
              method: "fill",
              route: "/dashboard/requests/new",
              selectorKey: "getByLabel(Title)",
              actionKind: "heal-and-continue",
              retryOutcomeKind: "healed",
              confidence: 0.8848,
              margin: 0.5091,
              fallback: null,
            },
          ],
        },
      ],
    };

    const markdown = renderHealModeEvidenceMarkdown(evidence);
    expect(markdown).toContain("near-duplicate-sibling-swap (seed 42, heal mode)");
    expect(markdown).toContain("near-dup.wizardFields.title");
    expect(markdown).toContain("heal-and-continue -> healed (confidence 0.8848, margin 0.5091)");
  });

  it("summarizes a drift-suspected target distinctly from a heal-attempt", () => {
    const evidence: HealModeEvidenceResult = {
      mutationClass: "sibling-reorder",
      seed: 42,
      generatedAt: "2026-07-11T00:00:00.000Z",
      results: [
        {
          targetId: "sibling-reorder.devices.active.rowOrder.row1",
          passed: false,
          errorMessage: "owner mismatch",
          matchAttempt: undefined,
          distractorBBox: undefined,
          policyEvents: [
            {
              kind: "drift-suspected",
              method: "innerText",
              route: "/dashboard/devices",
              selectorKey: 'locator([data-testid="devices-active"] tbody tr:nth-child(1) td:nth-child(2))',
              score: 0.6471,
            },
          ],
        },
      ],
    };

    const markdown = renderHealModeEvidenceMarkdown(evidence);
    expect(markdown).toContain("drift-suspected (self-similarity 0.6471)");
  });

  it("falls back to a plain pass/fail summary when no policy event was recorded at all", () => {
    const evidence: HealModeEvidenceResult = {
      mutationClass: "sibling-reorder",
      seed: 42,
      generatedAt: "2026-07-11T00:00:00.000Z",
      results: [
        {
          targetId: "sibling-reorder.wizard.resourceSelect",
          passed: false,
          errorMessage: "value mismatch",
          matchAttempt: undefined,
          distractorBBox: undefined,
          policyEvents: [],
        },
      ],
    };

    const markdown = renderHealModeEvidenceMarkdown(evidence);
    expect(markdown).toContain("failed (no policy event recorded)");
  });
});
