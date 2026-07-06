import { describe, expect, it } from "vitest";
import { TEXT_TRUNCATE_LIMIT, truncateText } from "./textTruncate.js";

describe("truncateText", () => {
  const cases: ReadonlyArray<{
    readonly name: string;
    readonly input: string;
    readonly expected: string | null;
  }> = [
    { name: "trims surrounding whitespace", input: "  Save  ", expected: "Save" },
    {
      name: "collapses internal whitespace runs",
      input: "Save\n\n  changes\t now",
      expected: "Save changes now",
    },
    { name: "empty string becomes null", input: "", expected: null },
    { name: "whitespace-only string becomes null", input: "   \n\t ", expected: null },
    {
      name: "exactly at the limit is kept whole",
      input: "a".repeat(TEXT_TRUNCATE_LIMIT),
      expected: "a".repeat(TEXT_TRUNCATE_LIMIT),
    },
    {
      name: "over the limit is hard-cut with an ellipsis marker",
      input: "a".repeat(TEXT_TRUNCATE_LIMIT + 20),
      expected: `${"a".repeat(TEXT_TRUNCATE_LIMIT)}…`,
    },
  ];

  it.each(cases)("$name", ({ input, expected }) => {
    expect(truncateText(input)).toBe(expected);
  });

  it("respects a custom limit", () => {
    expect(truncateText("abcdefgh", 4)).toBe("abcd…");
  });
});
