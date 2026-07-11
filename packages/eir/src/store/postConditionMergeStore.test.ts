import { describe, expect, it } from "vitest";
import type { PostCondition } from "../postCondition.js";
import {
  isSerializedPostConditionRouteFile,
  isSerializedPostConditionShard,
  mergePostConditionRouteFiles,
} from "./postConditionMergeStore.js";

function sample(toRoute = "/dashboard/devices"): PostCondition {
  return { v: 1, kind: "route-change", toRoute };
}

describe("mergePostConditionRouteFiles", () => {
  it("starts from the baseline when no shards touch a route", () => {
    const baseline = { "login.postconditions.json": { key: sample() } };
    expect(mergePostConditionRouteFiles(baseline, [])).toEqual(baseline);
  });

  it("overwrites a baseline selector when a shard captures it again (refresh policy)", () => {
    const baseline = { "login.postconditions.json": { key: sample("/old") } };
    const shard = { "login.postconditions.json": { key: sample("/new") } };
    expect(mergePostConditionRouteFiles(baseline, [shard])["login.postconditions.json"]?.["key"]).toEqual(
      sample("/new"),
    );
  });

  it("applies shards in the given order, later shards winning", () => {
    const shardA = { "login.postconditions.json": { key: sample("/from-worker-0") } };
    const shardB = { "login.postconditions.json": { key: sample("/from-worker-1") } };
    expect(
      mergePostConditionRouteFiles({}, [shardA, shardB])["login.postconditions.json"]?.["key"],
    ).toEqual(sample("/from-worker-1"));
  });
});

describe("isSerializedPostConditionRouteFile", () => {
  it("accepts a valid post-condition route file, including empty", () => {
    expect(isSerializedPostConditionRouteFile({ key: sample() })).toBe(true);
    expect(isSerializedPostConditionRouteFile({})).toBe(true);
  });

  it("rejects a malformed post-condition and a Fingerprint-shaped object", () => {
    expect(isSerializedPostConditionRouteFile({ key: { v: 1, kind: "not-real" } })).toBe(false);
    expect(
      isSerializedPostConditionRouteFile({
        key: { v: 1, tag: "button", attrs: {}, text: "x", label: null, ancestors: [], siblingIndex: 0, siblingCount: 1, bbox: { x: 0, y: 0, w: 1, h: 1 } },
      }),
    ).toBe(false);
  });
});

describe("isSerializedPostConditionShard", () => {
  it("accepts a valid shard", () => {
    expect(isSerializedPostConditionShard({ "login.postconditions.json": { key: sample() } })).toBe(true);
  });

  it("rejects a shard containing a malformed route file", () => {
    expect(
      isSerializedPostConditionShard({ "login.postconditions.json": { key: { v: 1, kind: "bogus" } } }),
    ).toBe(false);
  });
});
