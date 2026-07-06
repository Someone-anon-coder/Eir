import { describe, expect, it } from "vitest";
import { routeToFilename } from "./paths.js";

describe("routeToFilename", () => {
  const cases: ReadonlyArray<{ readonly route: string; readonly expected: string }> = [
    { route: "/plan-tarrif/create", expected: "plan-tarrif__create.json" },
    { route: "/plan/:id/edit", expected: "plan__id__edit.json" },
    { route: "/dashboard/devices", expected: "dashboard__devices.json" },
    { route: "/", expected: "index.json" },
  ];

  it.each(cases)("maps $route to $expected", ({ route, expected }) => {
    expect(routeToFilename(route)).toBe(expected);
  });
});
