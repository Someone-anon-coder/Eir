import { describe, expect, it } from "vitest";
import { loadDataset, loadRecords } from "./loadRecords.js";
import { runDir } from "./orchestrate.js";

describe("runDir", () => {
  it("the main dataset directory has no suffix", () => {
    expect(runDir("id-rename", 42)).toMatch(/\/runs\/id-rename-seed42$/);
  });

  it("a named dataset gets its own directory, which the main loader's pattern cannot match", () => {
    const verification = runDir("id-rename", 42, "verification");
    expect(verification).toMatch(/\/runs\/id-rename-seed42-verification$/);
    expect(verification).not.toBe(runDir("id-rename", 42));
    expect(/^(.*)-seed(\d+)$/.test("id-rename-seed42-verification")).toBe(false);
  });

  it("anchored variants are a separate dataset from plain reruns", () => {
    expect(runDir("sibling-reorder", 42, "verification-anchored")).not.toBe(
      runDir("sibling-reorder", 42, "verification"),
    );
  });

  it("loaders are exported for both the main dataset and named ones", () => {
    expect(typeof loadRecords).toBe("function");
    expect(typeof loadDataset).toBe("function");
  });
});
