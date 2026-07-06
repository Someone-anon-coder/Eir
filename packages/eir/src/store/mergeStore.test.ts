import { describe, expect, it } from "vitest";
import type { Fingerprint } from "../fingerprint.js";
import { isSerializedRouteFile, isSerializedShard, mergeRouteFiles } from "./mergeStore.js";

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

describe("mergeRouteFiles", () => {
  it("starts from the baseline when no shards touch a route", () => {
    const baseline = { "login.json": { key: sampleFingerprint() } };
    expect(mergeRouteFiles(baseline, [])).toEqual(baseline);
  });

  it("adds new routes/selectors introduced by a shard", () => {
    const baseline = {};
    const shard = { "login.json": { key: sampleFingerprint() } };
    expect(mergeRouteFiles(baseline, [shard])).toEqual(shard);
  });

  it("overwrites a baseline selector when a shard captures it again (refresh policy)", () => {
    const baseline = { "login.json": { key: sampleFingerprint({ text: "old" }) } };
    const shard = { "login.json": { key: sampleFingerprint({ text: "new" }) } };
    expect(mergeRouteFiles(baseline, [shard])["login.json"]?.["key"]?.text).toBe("new");
  });

  it("keeps a baseline selector untouched this run alongside a newly captured one", () => {
    const baseline = { "login.json": { untouched: sampleFingerprint({ text: "kept" }) } };
    const shard = { "login.json": { fresh: sampleFingerprint({ text: "new" }) } };
    const result = mergeRouteFiles(baseline, [shard]);
    expect(result["login.json"]).toEqual({
      untouched: sampleFingerprint({ text: "kept" }),
      fresh: sampleFingerprint({ text: "new" }),
    });
  });

  it("applies shards in the given order, later shards winning (deterministic, not wall-clock)", () => {
    const shardA = { "login.json": { key: sampleFingerprint({ text: "from-worker-0" }) } };
    const shardB = { "login.json": { key: sampleFingerprint({ text: "from-worker-1" }) } };
    expect(mergeRouteFiles({}, [shardA, shardB])["login.json"]?.["key"]?.text).toBe(
      "from-worker-1",
    );
    expect(mergeRouteFiles({}, [shardB, shardA])["login.json"]?.["key"]?.text).toBe(
      "from-worker-0",
    );
  });

  it("does not mutate its inputs", () => {
    const baseline = { "login.json": { key: sampleFingerprint() } };
    const shard = { "login.json": { other: sampleFingerprint() } };
    mergeRouteFiles(baseline, [shard]);
    expect(Object.keys(baseline["login.json"])).toEqual(["key"]);
  });
});

describe("isSerializedRouteFile", () => {
  it("accepts a valid route file", () => {
    expect(isSerializedRouteFile({ key: sampleFingerprint() })).toBe(true);
  });

  it("rejects a malformed fingerprint", () => {
    expect(isSerializedRouteFile({ key: { tag: "button" } })).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(isSerializedRouteFile("not an object")).toBe(false);
    expect(isSerializedRouteFile(null)).toBe(false);
  });

  it("accepts an empty route file", () => {
    expect(isSerializedRouteFile({})).toBe(true);
  });
});

describe("isSerializedShard", () => {
  it("accepts a valid shard", () => {
    expect(isSerializedShard({ "login.json": { key: sampleFingerprint() } })).toBe(true);
  });

  it("rejects a shard containing a malformed route file", () => {
    expect(isSerializedShard({ "login.json": { key: { tag: "button" } } })).toBe(false);
  });
});
