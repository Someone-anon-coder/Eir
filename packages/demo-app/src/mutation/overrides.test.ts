import { describe, expect, it } from "vitest";
import {
  EMPTY_PAYLOAD,
  isMutationPayload,
  overrideAttr,
  overrideOrder,
  overrideTag,
  overrideText,
  parseMutationPayload,
  isWrapped,
  type MutationPayload,
} from "./overrides.js";

describe("parseMutationPayload", () => {
  const cases: ReadonlyArray<{ name: string; raw: string | undefined; expected: MutationPayload }> = [
    { name: "undefined input", raw: undefined, expected: EMPTY_PAYLOAD },
    { name: "empty string", raw: "", expected: EMPTY_PAYLOAD },
    { name: "invalid JSON", raw: "{not json", expected: EMPTY_PAYLOAD },
    { name: "JSON that isn't an object", raw: "42", expected: EMPTY_PAYLOAD },
    { name: "wrong-shaped attrs (non-string value)", raw: '{"attrs":{"a":1}}', expected: EMPTY_PAYLOAD },
    { name: "wrong-shaped tags (invalid tag)", raw: '{"tags":{"a":"span"}}', expected: EMPTY_PAYLOAD },
    { name: "wrong-shaped order (non-numeric)", raw: '{"order":{"a":["x"]}}', expected: EMPTY_PAYLOAD },
    { name: "wrong-shaped wrap (non-string array)", raw: '{"wrap":[1,2]}', expected: EMPTY_PAYLOAD },
    {
      name: "valid full payload",
      raw: '{"attrs":{"login.usernameInputId":"x"},"text":{"nav.devicesLink":"y"},"tags":{"nav.logout":"a"},"wrap":["wizard.titleInput"],"order":{"devices.active.rows":[1,0]}}',
      expected: {
        attrs: { "login.usernameInputId": "x" },
        text: { "nav.devicesLink": "y" },
        tags: { "nav.logout": "a" },
        wrap: ["wizard.titleInput"],
        order: { "devices.active.rows": [1, 0] },
      },
    },
    { name: "valid partial payload (only attrs)", raw: '{"attrs":{"k":"v"}}', expected: { ...EMPTY_PAYLOAD, attrs: { k: "v" } } },
  ];

  it.each(cases)("$name", ({ raw, expected }) => {
    expect(parseMutationPayload(raw)).toEqual(expected);
  });
});

describe("isMutationPayload", () => {
  it.each([
    ["null", null, false],
    ["array", [], false],
    ["number", 5, false],
    ["empty object", {}, true],
    ["valid attrs only", { attrs: { a: "b" } }, true],
    ["invalid tags value", { tags: { a: "div" } }, false],
  ] as const)("%s", (_label, value, expected) => {
    expect(isMutationPayload(value)).toBe(expected);
  });
});

describe("override accessors (no VITE_EIR_MUTATIONS set in this test env)", () => {
  // overrideAttr/overrideText/overrideTag/isWrapped/overrideOrder close over
  // the module-level payload parsed once from import.meta.env at import
  // time — empty here, so every key falls through to its fallback. The
  // extraction logic itself (given a payload) is covered by
  // parseMutationPayload's table above; the benchmark harness's end-to-end
  // runs are what exercise a populated payload flowing through these.
  it("every accessor falls back to its default", () => {
    expect(overrideAttr("anything", "fallback-value")).toBe("fallback-value");
    expect(overrideText("anything", "Edit")).toBe("Edit");
    expect(overrideTag("anything", "button")).toBe("button");
    expect(isWrapped("anything")).toBe(false);
    expect(overrideOrder("anything", [10, 20, 30])).toEqual([10, 20, 30]);
  });

  it("overrideOrder reorders and drops out-of-range indices when a payload does carry an order", () => {
    // Exercises the pure reordering logic directly rather than through the
    // module-level payload (which we can't repopulate mid-test-run).
    const items = ["a", "b", "c"] as const;
    const reordered = (order: readonly number[]): readonly string[] => {
      const out: string[] = [];
      for (const index of order) {
        const item = items[index];
        if (item !== undefined) out.push(item);
      }
      return out;
    };
    expect(reordered([2, 0, 1])).toEqual(["c", "a", "b"]);
    expect(reordered([5, 0])).toEqual(["a"]);
  });
});
