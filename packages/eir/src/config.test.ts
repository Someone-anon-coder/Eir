import { describe, expect, it } from "vitest";
import { DEFAULT_EIR_CONFIG, defineEirConfig, type EirConfig } from "./config.js";

describe("defineEirConfig", () => {
  it("is an identity function — it returns exactly what was passed in", () => {
    const config: EirConfig = { mode: { mode: "suggest-only" } };
    expect(defineEirConfig(config)).toBe(config);
  });

  it("accepts a fully-specified heal-mode config", () => {
    const config: EirConfig = {
      mode: { mode: "heal", healThreshold: 0.7, suggestThreshold: 0.3 },
      routeOverrides: [{ pattern: /^tenant-\w+$/, token: ":tenant" }],
    };
    expect(defineEirConfig(config)).toEqual(config);
  });
});

describe("DEFAULT_EIR_CONFIG", () => {
  it("ships suggest-only as the default posture (Q6)", () => {
    expect(DEFAULT_EIR_CONFIG).toEqual({ mode: { mode: "suggest-only" } });
  });
});
