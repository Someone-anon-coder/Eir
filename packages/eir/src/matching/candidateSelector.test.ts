import { describe, expect, it } from "vitest";
import { candidateSelector } from "./candidateSelector.js";

describe("candidateSelector", () => {
  it.each(["button", "a", "input"])("expands %s into the full tag-swap group", (tag) => {
    const selector = candidateSelector(tag);
    expect(selector).toContain("button");
    expect(selector).toContain("a");
    expect(selector).toContain("input[type=submit]");
    expect(selector).toContain("input[type=button]");
  });

  it("leaves an unrelated tag untouched", () => {
    expect(candidateSelector("select")).toBe("select");
  });
});
