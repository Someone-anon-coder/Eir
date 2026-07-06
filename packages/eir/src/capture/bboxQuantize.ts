import type { QuantizedBoundingBox } from "../fingerprint.js";
import type { RawBoundingBox } from "./rawExtract.js";

export const BBOX_GRID = 32;

function quantize(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

export function quantizeBbox(raw: RawBoundingBox, grid: number = BBOX_GRID): QuantizedBoundingBox {
  return {
    x: quantize(raw.x, grid),
    y: quantize(raw.y, grid),
    w: quantize(raw.width, grid),
    h: quantize(raw.height, grid),
  };
}
