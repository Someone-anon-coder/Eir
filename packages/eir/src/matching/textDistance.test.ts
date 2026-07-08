import { describe, expect, it } from "vitest";
import { normalizedEditSimilarity, textSimilarity, tokenOverlapSimilarity } from "./textDistance.js";

describe("normalizedEditSimilarity", () => {
  it.each([
    ["Provisioning", "Provisioning", 1],
    ["", "", 1],
    ["abc", "xyz", 0],
  ])("scores %s vs %s as %d", (a, b, expected) => {
    expect(normalizedEditSimilarity(a, b)).toBeCloseTo(expected);
  });

  it("gives partial credit for a small edit", () => {
    const score = normalizedEditSimilarity("Log Out", "Sign Out");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("is symmetric", () => {
    expect(normalizedEditSimilarity("Cancel", "Go Back")).toBeCloseTo(
      normalizedEditSimilarity("Go Back", "Cancel"),
    );
  });
});

describe("tokenOverlapSimilarity", () => {
  it("scores identical token sets as 1", () => {
    expect(tokenOverlapSimilarity("Requested By", "By Requested")).toBeCloseTo(1);
  });

  it("scores disjoint token sets as 0", () => {
    expect(tokenOverlapSimilarity("Edit", "Delete")).toBe(0);
  });

  it("gives partial credit for partial overlap", () => {
    const score = tokenOverlapSimilarity("Delete Account", "Remove Account");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("treats two empty strings as a full match, one-empty as zero", () => {
    expect(tokenOverlapSimilarity("", "")).toBe(1);
    expect(tokenOverlapSimilarity("Cancel", "")).toBe(0);
  });
});

describe("textSimilarity (blend)", () => {
  it("scores identical strings as 1", () => {
    expect(textSimilarity("Confirm Delete", "Confirm Delete")).toBeCloseTo(1);
  });

  it("scores completely unrelated single words low", () => {
    expect(textSimilarity("Edit", "Delete")).toBeLessThan(0.5);
  });

  it("gives a reworded phrase meaningfully more credit than an unrelated one", () => {
    const reworded = textSimilarity("Delete Account", "Remove Account");
    const unrelated = textSimilarity("Delete Account", "Provisioning");
    expect(reworded).toBeGreaterThan(unrelated);
  });
});
