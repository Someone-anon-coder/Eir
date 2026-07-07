import { describe, expect, it } from "vitest";
import { classifyProbeRun, classifyUnhealedFailure } from "./outcome.js";

describe("classifyUnhealedFailure", () => {
  it("always classifies as missed — Phase 4 has no matcher", () => {
    expect(classifyUnhealedFailure()).toEqual({ kind: "missed" });
  });
});

describe("classifyProbeRun", () => {
  it("a failed probe (the expected case) classifies as mutation-effective/missed", () => {
    const result = classifyProbeRun(false, "locator.click: Timeout 5000ms exceeded");
    expect(result).toEqual({
      status: "mutation-effective",
      outcome: { kind: "missed" },
      error: "locator.click: Timeout 5000ms exceeded",
    });
  });

  it("a failed probe with no error message still classifies, with an empty error string", () => {
    const result = classifyProbeRun(false, undefined);
    expect(result).toEqual({
      status: "mutation-effective",
      outcome: { kind: "missed" },
      error: "",
    });
  });

  it("an unexpectedly passing probe is flagged mutation-ineffective, never a Blueprint outcome", () => {
    const result = classifyProbeRun(true, undefined);
    expect(result).toEqual({ status: "mutation-ineffective" });
  });
});
