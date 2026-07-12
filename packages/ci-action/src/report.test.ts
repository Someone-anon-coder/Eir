import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InvalidReportError, readEirReport } from "./report.js";

describe("readEirReport", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "eir-ci-action-report-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("parses an empty report", async () => {
    const file = path.join(dir, "eir-report.json");
    await writeFile(file, JSON.stringify({ rows: [] }));
    const report = await readEirReport(file);
    expect(report.rows).toEqual([]);
  });

  it("parses a real-shaped report row", async () => {
    const file = path.join(dir, "eir-report.json");
    await writeFile(
      file,
      JSON.stringify({
        rows: [
          {
            testTitle: "opens the delete dialog",
            method: "click",
            route: "/dashboard/account",
            selectorKey: 'getByTestId("open-delete-account")',
            action: "suggested",
            confidence: 0.7353,
            suggestion: 'getByTestId("open-delete-account-mut")',
            screenshotFile: "screenshots/opens-the-delete-dialog-0.png",
          },
        ],
      }),
    );
    const report = await readEirReport(file);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]?.action).toBe("suggested");
  });

  const invalidShapes: readonly [string, unknown][] = [
    ["not an object", "not json shaped as a report"],
    ["missing rows", {}],
    ["rows not an array", { rows: "nope" }],
    [
      "row missing selectorKey",
      {
        rows: [
          {
            testTitle: "t",
            method: "m",
            route: "/",
            action: "missed",
            confidence: null,
            suggestion: null,
            screenshotFile: null,
          },
        ],
      },
    ],
    [
      "row with an unknown action",
      {
        rows: [
          {
            testTitle: "t",
            method: "m",
            route: "/",
            selectorKey: "k",
            action: "not-a-real-action",
            confidence: null,
            suggestion: null,
            screenshotFile: null,
          },
        ],
      },
    ],
  ];

  it.each(invalidShapes)("rejects: %s", async (_label, payload) => {
    const file = path.join(dir, "eir-report.json");
    await writeFile(file, JSON.stringify(payload));
    await expect(readEirReport(file)).rejects.toBeInstanceOf(InvalidReportError);
  });
});
