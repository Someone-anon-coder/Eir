import { describe, expect, it } from "vitest";
import { BBOX_GRID, quantizeBbox } from "./bboxQuantize.js";

describe("quantizeBbox", () => {
  it("rounds each dimension to the nearest 32px grid line", () => {
    const result = quantizeBbox({ x: 100, y: 15, width: 200, height: 17 });
    expect(result).toEqual({ x: 96, y: 0, w: 192, h: 32 });
  });

  it("rounds an exact multiple of the grid to itself", () => {
    const result = quantizeBbox({ x: 64, y: 0, width: 320, height: 32 });
    expect(result).toEqual({ x: 64, y: 0, w: 320, h: 32 });
  });

  it("absorbs sub-pixel reflow noise identically", () => {
    const a = quantizeBbox({ x: 100.2, y: 50.1, width: 199.8, height: 40.4 });
    const b = quantizeBbox({ x: 101.9, y: 49.6, width: 200.6, height: 39.9 });
    expect(a).toEqual(b);
  });

  it("supports a custom grid size", () => {
    expect(quantizeBbox({ x: 10, y: 10, width: 10, height: 10 }, 10)).toEqual({
      x: 10,
      y: 10,
      w: 10,
      h: 10,
    });
  });

  it("defaults to the documented 32px grid", () => {
    expect(BBOX_GRID).toBe(32);
  });
});
