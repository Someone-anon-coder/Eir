import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compareToCollector, parseTraceActions } from "./traceRead.js";

const REAL = readFileSync(new URL("./fixtures/trace-click-edit.trace", import.meta.url), "utf-8");

describe("parseTraceActions on a real Playwright 1.65.1 trace", () => {
  const actions = parseTraceActions(REAL);

  it("finds the click and ignores the expect (not an interaction)", () => {
    expect(actions).toHaveLength(1);
    expect(actions[0]?.method).toBe("click");
  });

  it("reads the element the click hit, and its marked ancestors, from the snapshot", () => {
    expect(actions[0]).toMatchObject({
      tag: "BUTTON",
      ownMarker: "devices.row.dev-10.edit",
      nearestMarker: "devices.row.dev-10.edit",
    });
    expect(actions[0]?.markedAncestors).toEqual([
      "devices.archived.table",
      "devices.archived.card",
      "devices.pageClassName",
      "nav.layoutClassName",
    ]);
  });
});

describe("parseTraceActions robustness", () => {
  it.each([
    ["empty", ""],
    ["garbage", "not json\n{broken"],
  ])("%s input yields no actions", (_n, text) => {
    expect(parseTraceActions(text)).toEqual([]);
  });

  it("an interaction with no readable target snapshot yields no entry rather than a guess", () => {
    const before = JSON.stringify({ type: "before", callId: "c1", method: "click" });
    expect(parseTraceActions(before)).toEqual([]);
  });
});

describe("compareToCollector", () => {
  const click = parseTraceActions(REAL);
  it("agrees when the sets match", () => {
    expect(compareToCollector(click, ["devices.row.dev-10.edit"]).agree).toBe(true);
  });
  it("lists every disagreement in both directions", () => {
    const r = compareToCollector(click, ["devices.row.dev-2.edit"]);
    expect(r.agree).toBe(false);
    expect(r.onlyInTrace).toEqual(["devices.row.dev-10.edit"]);
    expect(r.onlyInCollector).toEqual(["devices.row.dev-2.edit"]);
  });
  it("no collector events and no traced actions agree trivially", () => {
    expect(compareToCollector([], []).agree).toBe(true);
  });

  it("path mode counts every marked ancestor, matching how container targets are judged", () => {
    const keys = [
      "devices.row.dev-10.edit",
      "devices.archived.table",
      "devices.archived.card",
      "devices.pageClassName",
      "nav.layoutClassName",
    ];
    expect(compareToCollector(click, keys, "path").agree).toBe(true);
    expect(compareToCollector(click, keys, "nearest").agree).toBe(false);
  });
});
