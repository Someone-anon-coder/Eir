import { describe, expect, it } from "vitest";
import { normalizeSelector } from "./selectorNormalize.js";
import type { ChainHop } from "./selectorIdentity.js";

describe("normalizeSelector", () => {
  it("does not template getByText's literal — two distinct static calls must not collide", () => {
    const a = normalizeSelector([{ method: "getByText", args: ["Monthly"] }]);
    const b = normalizeSelector([{ method: "getByText", args: ["Annual"] }]);
    expect(a.key).toBe('getByText("Monthly")');
    expect(b.key).toBe('getByText("Annual")');
    expect(a.key).not.toBe(b.key);
    expect(a.instanceParams).toEqual([]);
  });

  it("does not template getByLabel's literal — the discovered collision case", () => {
    const a = normalizeSelector([{ method: "getByLabel", args: ["Requested By"] }]);
    const b = normalizeSelector([{ method: "getByLabel", args: ["Duration"] }]);
    expect(a.key).toBe('getByLabel("Requested By")');
    expect(b.key).toBe('getByLabel("Duration")');
    expect(a.key).not.toBe(b.key);
  });

  it("does not template a RegExp arg to getByText", () => {
    const chainPath: readonly ChainHop[] = [{ method: "getByText", args: [/Month(ly)?/i] }];
    const result = normalizeSelector(chainPath);
    expect(result.key).toBe("getByText(/Month(ly)?/i)");
    expect(result.instanceParams).toEqual([]);
  });

  it("never templates getByTestId — stable identifiers by design", () => {
    const chainPath: readonly ChainHop[] = [{ method: "getByTestId", args: ["device-row-edit"] }];
    const result = normalizeSelector(chainPath);
    expect(result.key).toBe('getByTestId("device-row-edit")');
    expect(result.instanceParams).toEqual([]);
  });

  it("does not template getByRole's options.name — the second discovered collision case", () => {
    const a = normalizeSelector([{ method: "getByRole", args: ["link", { name: "Devices" }] }]);
    const b = normalizeSelector([{ method: "getByRole", args: ["link", { name: "Account" }] }]);
    expect(a.key).toBe('getByRole("link", {"name":"Devices"})');
    expect(b.key).toBe('getByRole("link", {"name":"Account"})');
    expect(a.key).not.toBe(b.key);
    expect(a.instanceParams).toEqual([]);
  });

  it("sorts option keys so call-site property order never affects the key", () => {
    const a = normalizeSelector([
      { method: "getByRole", args: ["button", { name: "Save", exact: true }] },
    ]);
    const b = normalizeSelector([
      { method: "getByRole", args: ["button", { exact: true, name: "Save" }] },
    ]);
    expect(a.key).toBe(b.key);
  });

  it("templates the quoted literal inside normalize-space() XPath text matches", () => {
    const chainPath: readonly ChainHop[] = [
      { method: "locator", args: ["xpath=//button[normalize-space()='Monthly']"] },
    ];
    const result = normalizeSelector(chainPath);
    expect(result.key).toBe("locator(\"xpath=//button[normalize-space()='{TEXT}']\")");
    expect(result.instanceParams).toEqual(["Monthly"]);
  });

  it("templates contains(text(), ...) XPath text matches", () => {
    const chainPath: readonly ChainHop[] = [
      { method: "locator", args: ['xpath=//td[contains(text(), "Front Desk Tablet")]'] },
    ];
    const result = normalizeSelector(chainPath);
    expect(result.instanceParams).toEqual(["Front Desk Tablet"]);
    expect(result.key).toContain("{TEXT}");
  });

  it("leaves a plain CSS locator selector untouched", () => {
    const chainPath: readonly ChainHop[] = [{ method: "locator", args: ["#device-table tr"] }];
    const result = normalizeSelector(chainPath);
    expect(result.key).toBe('locator("#device-table tr")');
    expect(result.instanceParams).toEqual([]);
  });

  it("composes a multi-hop chain untouched when no hop is XPath-templatable", () => {
    const chainPath: readonly ChainHop[] = [
      { method: "getByTestId", args: ["device-row"] },
      { method: "getByText", args: ["Front Desk Tablet"] },
    ];
    const result = normalizeSelector(chainPath);
    expect(result.key).toBe('getByTestId("device-row") > getByText("Front Desk Tablet")');
    expect(result.instanceParams).toEqual([]);
  });
});
