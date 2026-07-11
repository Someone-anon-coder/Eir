import { describe, expect, it } from "vitest";
import {
  derivePostCondition,
  isPostCondition,
  postConditionMatches,
  POST_CONDITION_SCHEMA_VERSION,
  type PostCondition,
} from "./postCondition.js";

describe("derivePostCondition", () => {
  it("reports route-change when the route differs, regardless of element count", () => {
    const result = derivePostCondition(
      { route: "/login", elementCount: 40 },
      { route: "/dashboard/devices", elementCount: 12 },
    );
    expect(result).toEqual({
      v: POST_CONDITION_SCHEMA_VERSION,
      kind: "route-change",
      toRoute: "/dashboard/devices",
    });
  });

  it("reports dom-count-change increased when a modal/row appears on the same route", () => {
    const result = derivePostCondition(
      { route: "/dashboard/devices", elementCount: 40 },
      { route: "/dashboard/devices", elementCount: 55 },
    );
    expect(result).toEqual({ v: POST_CONDITION_SCHEMA_VERSION, kind: "dom-count-change", sign: "increased" });
  });

  it("reports dom-count-change decreased when a row/modal is removed on the same route", () => {
    const result = derivePostCondition(
      { route: "/dashboard/devices", elementCount: 55 },
      { route: "/dashboard/devices", elementCount: 40 },
    );
    expect(result).toEqual({ v: POST_CONDITION_SCHEMA_VERSION, kind: "dom-count-change", sign: "decreased" });
  });

  it("reports none when neither route nor element count changed", () => {
    const result = derivePostCondition(
      { route: "/dashboard/devices", elementCount: 40 },
      { route: "/dashboard/devices", elementCount: 40 },
    );
    expect(result).toEqual({ v: POST_CONDITION_SCHEMA_VERSION, kind: "none" });
  });
});

describe("postConditionMatches", () => {
  const routeChange = (toRoute: string): PostCondition => ({
    v: POST_CONDITION_SCHEMA_VERSION,
    kind: "route-change",
    toRoute,
  });
  const countChange = (sign: "increased" | "decreased"): PostCondition => ({
    v: POST_CONDITION_SCHEMA_VERSION,
    kind: "dom-count-change",
    sign,
  });
  const none: PostCondition = { v: POST_CONDITION_SCHEMA_VERSION, kind: "none" };

  it("stored none always matches — the honest partial-coverage case", () => {
    expect(postConditionMatches(none, routeChange("/anything"))).toBe(true);
    expect(postConditionMatches(none, countChange("decreased"))).toBe(true);
    expect(postConditionMatches(none, none)).toBe(true);
  });

  it("route-change matches only the same destination route", () => {
    expect(postConditionMatches(routeChange("/dashboard/devices"), routeChange("/dashboard/devices"))).toBe(true);
    expect(postConditionMatches(routeChange("/dashboard/devices"), routeChange("/login"))).toBe(false);
  });

  it("route-change observed as none or dom-count-change is a mismatch", () => {
    expect(postConditionMatches(routeChange("/dashboard/devices"), none)).toBe(false);
    expect(postConditionMatches(routeChange("/dashboard/devices"), countChange("increased"))).toBe(false);
  });

  it("dom-count-change matches only the same sign", () => {
    expect(postConditionMatches(countChange("increased"), countChange("increased"))).toBe(true);
    expect(postConditionMatches(countChange("increased"), countChange("decreased"))).toBe(false);
  });

  it("dom-count-change observed as none or route-change is a mismatch", () => {
    expect(postConditionMatches(countChange("decreased"), none)).toBe(false);
    expect(postConditionMatches(countChange("decreased"), routeChange("/login"))).toBe(false);
  });
});

describe("isPostCondition", () => {
  it("accepts every valid variant", () => {
    expect(isPostCondition({ v: 1, kind: "none" })).toBe(true);
    expect(isPostCondition({ v: 1, kind: "route-change", toRoute: "/x" })).toBe(true);
    expect(isPostCondition({ v: 1, kind: "dom-count-change", sign: "increased" })).toBe(true);
  });

  it("rejects a wrong schema version", () => {
    expect(isPostCondition({ v: 2, kind: "none" })).toBe(false);
  });

  it("rejects an unknown kind", () => {
    expect(isPostCondition({ v: 1, kind: "something-else" })).toBe(false);
  });

  it("rejects route-change missing toRoute, and dom-count-change with a bad sign", () => {
    expect(isPostCondition({ v: 1, kind: "route-change" })).toBe(false);
    expect(isPostCondition({ v: 1, kind: "dom-count-change", sign: "sideways" })).toBe(false);
  });

  it("rejects a Fingerprint-shaped object (route-file co-location safety)", () => {
    expect(
      isPostCondition({
        v: 1,
        tag: "button",
        attrs: {},
        text: "Save",
        label: null,
        ancestors: [],
        siblingIndex: 0,
        siblingCount: 1,
        bbox: { x: 0, y: 0, w: 32, h: 32 },
      }),
    ).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isPostCondition(null)).toBe(false);
    expect(isPostCondition("none")).toBe(false);
  });
});
