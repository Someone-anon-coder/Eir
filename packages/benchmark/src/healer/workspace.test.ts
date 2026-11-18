import { describe, expect, it } from "vitest";
import { isToolOutput, outOfBoundsPaths } from "./workspace.js";

const SPEC = "tests/a.spec.ts";
const map = (entries: Record<string, string>): Map<string, string> =>
  new Map(Object.entries(entries));

describe("outOfBoundsPaths", () => {
  const before = map({
    [SPEC]: "1",
    "playwright.config.ts": "c",
    ".mcp.json": "m",
    ".claude/agents/h.md": "h",
  });

  const cases: ReadonlyArray<readonly [string, Record<string, string>, string[]]> = [
    ["only the spec changed", { ...Object.fromEntries(before), [SPEC]: "2" }, []],
    [
      "config edited",
      { ...Object.fromEntries(before), "playwright.config.ts": "x" },
      ["playwright.config.ts"],
    ],
    [
      "agent definition edited",
      { ...Object.fromEntries(before), ".claude/agents/h.md": "x" },
      [".claude/agents/h.md"],
    ],
    ["new file written", { ...Object.fromEntries(before), "notes.md": "n" }, ["notes.md"]],
    [
      "a file deleted",
      { [SPEC]: "1", ".mcp.json": "m", ".claude/agents/h.md": "h" },
      ["playwright.config.ts"],
    ],
    [
      "MCP console log is tool output, not an edit",
      { ...Object.fromEntries(before), ".playwright-mcp/console-1.log": "l" },
      [],
    ],
    [
      "tool output does not hide a real edit beside it",
      { ...Object.fromEntries(before), ".playwright-mcp/console-1.log": "l", "package.json": "p" },
      ["package.json"],
    ],
  ];
  it.each(cases)("%s", (_name, afterEntries, expected) => {
    expect(outOfBoundsPaths(before, map(afterEntries), SPEC)).toEqual(expected);
  });
});

describe("isToolOutput", () => {
  it.each([
    [".playwright-mcp/console-1.log", true],
    [".playwright-mcp/page-2.yml", true],
    ["tests/.playwright-mcp/x", false],
    [".playwright-mcp-fake/x", false],
    ["tests/a.spec.ts", false],
  ])("%s -> %s", (p, expected) => {
    expect(isToolOutput(p)).toBe(expected);
  });
});
