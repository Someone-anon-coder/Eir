import { describe, expect, it } from "vitest";
import { filterClasses, isUtilityClass } from "./classFilter.js";

describe("isUtilityClass", () => {
  const utilityCases: readonly string[] = [
    "flex",
    "grid",
    "hidden",
    "inline-flex",
    "absolute",
    "relative",
    "p-4",
    "px-2",
    "space-x-4",
    "w-full",
    "min-w-0",
    "text-sm",
    "bg-blue-500",
    "border",
    "border-t",
    "rounded-lg",
    "items-center",
    "justify-between",
    "overflow-hidden",
    "transition-all",
    "sr-only",
    "hover:bg-blue-600",
    "focus:outline-none",
    "sm:hidden",
    "dark:bg-slate-900",
  ];

  it.each(utilityCases)("treats %s as utility noise", (token) => {
    expect(isUtilityClass(token)).toBe(true);
  });

  const salientCases: readonly string[] = [
    "data-table",
    "wizard-step",
    "plan-card",
    "device-row",
    "modal-overlay",
    "borderless-card", // starts with "border" but is not the utility token itself
    "textarea-wrapper", // starts with "text" but is not the utility token itself
  ];

  it.each(salientCases)("treats %s as salient, not utility noise", (token) => {
    expect(isUtilityClass(token)).toBe(false);
  });
});

describe("filterClasses", () => {
  it("keeps only salient tokens from a mixed class list", () => {
    const result = filterClasses(["flex", "p-4", "data-table", "hover:bg-blue-500", "wizard-step"]);
    expect(result).toEqual(["data-table", "wizard-step"]);
  });

  it("returns an empty array when every token is utility noise", () => {
    expect(filterClasses(["flex", "items-center", "gap-2"])).toEqual([]);
  });

  it("returns an empty array for an empty input", () => {
    expect(filterClasses([])).toEqual([]);
  });
});
