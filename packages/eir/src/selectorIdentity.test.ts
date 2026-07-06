import { describe, expect, it } from "vitest";
import { extendChain, routeFromUrl, type ChainHop } from "./selectorIdentity.js";

describe("routeFromUrl", () => {
  const cases: ReadonlyArray<{ readonly url: string; readonly expected: string }> = [
    { url: "http://localhost:5173/dashboard/devices", expected: "/dashboard/devices" },
    { url: "http://localhost:5173/", expected: "/" },
    { url: "http://localhost:5173/dashboard/devices?tab=archived", expected: "/dashboard/devices" },
    {
      url: "http://localhost:5173/dashboard/requests/new#step-2",
      expected: "/dashboard/requests/new",
    },
    { url: "https://example.com:8080/login", expected: "/login" },
  ];

  it.each(cases)("strips origin, query, and hash from $url", ({ url, expected }) => {
    expect(routeFromUrl(url)).toBe(expected);
  });
});

describe("extendChain", () => {
  it("appends a hop without mutating the parent chain", () => {
    const parent: readonly ChainHop[] = [{ method: "getByText", args: ["Legacy Barcode Scanner"] }];

    const result = extendChain(parent, "locator", ["xpath=ancestor::tr"]);

    expect(result).toEqual([
      { method: "getByText", args: ["Legacy Barcode Scanner"] },
      { method: "locator", args: ["xpath=ancestor::tr"] },
    ]);
    expect(parent).toEqual([{ method: "getByText", args: ["Legacy Barcode Scanner"] }]);
    expect(result).not.toBe(parent);
  });

  it("starts a fresh chain from an empty parent", () => {
    const result = extendChain([], "getByTestId", ["device-row-edit"]);
    expect(result).toEqual([{ method: "getByTestId", args: ["device-row-edit"] }]);
  });
});
