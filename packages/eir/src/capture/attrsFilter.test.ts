import { describe, expect, it } from "vitest";
import { filterAttrs } from "./attrsFilter.js";

describe("filterAttrs", () => {
  const cases: ReadonlyArray<{
    readonly name: string;
    readonly input: Readonly<Record<string, string>>;
    readonly expected: Readonly<Record<string, string>>;
  }> = [
    {
      name: "keeps the fixed allow-list",
      input: {
        id: "save-btn",
        name: "save",
        type: "submit",
        "data-testid": "save",
        role: "button",
      },
      expected: {
        id: "save-btn",
        name: "save",
        type: "submit",
        "data-testid": "save",
        role: "button",
      },
    },
    {
      name: "keeps any aria-* attribute generically",
      input: { "aria-label": "Save changes", "aria-describedby": "save-hint" },
      expected: { "aria-label": "Save changes", "aria-describedby": "save-hint" },
    },
    {
      name: "drops class, style, href, src, and non-testid data-* attributes",
      input: {
        class: "flex p-4 data-table",
        style: "color: red",
        href: "/plans/42",
        src: "/icon.svg",
        "data-row-id": "42",
      },
      expected: {},
    },
    {
      name: "mixes allowed and disallowed keys correctly",
      input: { id: "row-3", class: "hover:bg-blue-500", "aria-hidden": "true" },
      expected: { id: "row-3", "aria-hidden": "true" },
    },
    {
      name: "empty input produces empty output",
      input: {},
      expected: {},
    },
  ];

  it.each(cases)("$name", ({ input, expected }) => {
    expect(filterAttrs(input)).toEqual(expected);
  });
});
