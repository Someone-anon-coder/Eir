import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Fingerprint } from "../fingerprint.js";
import type { PostCondition } from "../postCondition.js";
import eirGlobalTeardown, { runGlobalTeardown } from "./globalTeardown.js";
import { postConditionShardsDir, routesDir, shardsDir } from "./paths.js";
import { stableStringify } from "./stableStringify.js";

function sampleFingerprint(overrides: Partial<Fingerprint> = {}): Fingerprint {
  return {
    v: 1,
    tag: "button",
    attrs: {},
    text: "Save",
    label: null,
    ancestors: [],
    siblingIndex: 0,
    siblingCount: 1,
    bbox: { x: 0, y: 0, w: 32, h: 32 },
    ...overrides,
  };
}

describe("runGlobalTeardown", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "eir-teardown-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("merges baseline + shards, writes final routes, and deletes the shard dir", async () => {
    await mkdir(routesDir(dir), { recursive: true });
    await writeFile(
      path.join(routesDir(dir), "login.json"),
      stableStringify({ untouched: sampleFingerprint({ text: "kept" }) }),
    );

    await mkdir(shardsDir(dir), { recursive: true });
    await writeFile(
      path.join(shardsDir(dir), "worker-0.json"),
      stableStringify({ "login.json": { fresh: sampleFingerprint({ text: "new" }) } }),
    );

    await runGlobalTeardown(dir);

    const merged = JSON.parse(
      await readFile(path.join(routesDir(dir), "login.json"), "utf8"),
    ) as unknown;
    expect(merged).toEqual({
      untouched: sampleFingerprint({ text: "kept" }),
      fresh: sampleFingerprint({ text: "new" }),
    });

    await expect(readdir(shardsDir(dir))).rejects.toThrow();
  });

  it("is a no-op (no crash) when neither routes nor shards exist yet", async () => {
    await expect(runGlobalTeardown(dir)).resolves.toBeUndefined();
  });

  it("also merges post-conditions, into a sibling file, in the same teardown pass (NOTE-001)", async () => {
    const samplePostCondition: PostCondition = { v: 1, kind: "dom-count-change", sign: "decreased" };

    await mkdir(routesDir(dir), { recursive: true });
    await writeFile(
      path.join(routesDir(dir), "login.json"),
      stableStringify({ untouched: sampleFingerprint({ text: "kept" }) }),
    );

    await mkdir(shardsDir(dir), { recursive: true });
    await writeFile(
      path.join(shardsDir(dir), "worker-0.json"),
      stableStringify({ "login.json": { fresh: sampleFingerprint({ text: "new" }) } }),
    );

    await mkdir(postConditionShardsDir(dir), { recursive: true });
    await writeFile(
      path.join(postConditionShardsDir(dir), "worker-0.json"),
      stableStringify({ "login.postconditions.json": { fresh: samplePostCondition } }),
    );

    await runGlobalTeardown(dir);

    const mergedFingerprints = JSON.parse(
      await readFile(path.join(routesDir(dir), "login.json"), "utf8"),
    ) as unknown;
    expect(mergedFingerprints).toEqual({
      untouched: sampleFingerprint({ text: "kept" }),
      fresh: sampleFingerprint({ text: "new" }),
    });

    const mergedPostConditions = JSON.parse(
      await readFile(path.join(routesDir(dir), "login.postconditions.json"), "utf8"),
    ) as unknown;
    expect(mergedPostConditions).toEqual({ fresh: samplePostCondition });

    await expect(readdir(postConditionShardsDir(dir))).rejects.toThrow();
  });
});

describe("eirGlobalTeardown (Playwright's default export)", () => {
  it("ignores whatever argument Playwright passes (a FullConfig object, not a baseDir string)", async () => {
    await expect(eirGlobalTeardown({ someConfigField: "irrelevant" })).resolves.toBeUndefined();
  });
});
