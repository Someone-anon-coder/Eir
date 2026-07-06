import { describe, expect, it } from "vitest";
import { normalizeRoute } from "./routeNormalize.js";

describe("normalizeRoute", () => {
  const cases: ReadonlyArray<{ readonly pathname: string; readonly expected: string }> = [
    { pathname: "/plan/42/edit", expected: "/plan/:id/edit" },
    { pathname: "/dashboard/devices", expected: "/dashboard/devices" },
    { pathname: "/", expected: "/" },
    {
      pathname: "/plan/3fa85f64-5717-4562-b3fc-2c963f66afa6/edit",
      expected: "/plan/:id/edit",
    },
    { pathname: "/plan/42/edit/99", expected: "/plan/:id/edit/:id" },
    { pathname: "/dashboard/requests/new", expected: "/dashboard/requests/new" },
  ];

  it.each(cases)("normalizes $pathname to $expected", ({ pathname, expected }) => {
    expect(normalizeRoute(pathname)).toBe(expected);
  });

  it("applies a config override before the built-in heuristics", () => {
    const result = normalizeRoute("/dashboard/devices/legacy-scanner", [
      { pattern: /^legacy-.+$/, token: ":slug" },
    ]);
    expect(result).toBe("/dashboard/devices/:slug");
  });

  it("override does not affect segments it doesn't match", () => {
    const result = normalizeRoute("/plan/42/edit", [{ pattern: /^never-matches$/, token: ":x" }]);
    expect(result).toBe("/plan/:id/edit");
  });
});
