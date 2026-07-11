import { describe, expect, it } from "vitest";
import type { PostCondition } from "../postCondition.js";
import { PostConditionStore, postConditionRouteMapToPlainObject } from "./postConditionStore.js";

function sampleRouteChange(toRoute = "/dashboard/devices"): PostCondition {
  return { v: 1, kind: "route-change", toRoute };
}

describe("PostConditionStore", () => {
  it("records a post-condition under its route and selector key", () => {
    const store = new PostConditionStore();
    store.record("/login", 'getByTestId("submit")', sampleRouteChange());

    expect(store.routes.get("/login")?.get('getByTestId("submit")')).toEqual(sampleRouteChange());
  });

  it("last write wins for the same route+selector key", () => {
    const store = new PostConditionStore();
    store.record("/dashboard/devices", "key", sampleRouteChange("/a"));
    store.record("/dashboard/devices", "key", sampleRouteChange("/b"));

    expect(store.routes.get("/dashboard/devices")?.get("key")).toEqual(sampleRouteChange("/b"));
  });

  it("waitForPending drains tracked captures, never rejecting", async () => {
    const store = new PostConditionStore();
    store.trackPending(Promise.reject(new Error("boom")));
    await expect(store.waitForPending()).resolves.toBeUndefined();
  });
});

describe("postConditionRouteMapToPlainObject", () => {
  it("converts nested Maps into plain nested objects", () => {
    const store = new PostConditionStore();
    store.record("/login", 'getByTestId("submit")', sampleRouteChange());

    expect(postConditionRouteMapToPlainObject(store.routes)).toEqual({
      "/login": { 'getByTestId("submit")': sampleRouteChange() },
    });
  });

  it("returns an empty object for an empty store", () => {
    expect(postConditionRouteMapToPlainObject(new PostConditionStore().routes)).toEqual({});
  });
});
