import { describe, expect, it } from "vitest";
import { stableStringify } from "./stableStringify.js";

describe("stableStringify", () => {
  it("sorts object keys regardless of insertion order", () => {
    const a = stableStringify({ b: 1, a: 2, c: 3 });
    const b = stableStringify({ c: 3, a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toContain('"a": 2');
  });

  it("sorts nested object keys recursively", () => {
    const result = stableStringify({ outer: { z: 1, a: 2 } });
    expect(result.indexOf('"a"')).toBeLessThan(result.indexOf('"z"'));
  });

  it("preserves array element order (order is meaningful, not sorted)", () => {
    const result = stableStringify({ list: [{ z: 1 }, { a: 2 }] });
    const parsed = JSON.parse(result) as { list: unknown[] };
    expect(parsed.list).toEqual([{ z: 1 }, { a: 2 }]);
  });

  it("ends with a trailing newline", () => {
    expect(stableStringify({ a: 1 })).toMatch(/\n$/);
  });
});
