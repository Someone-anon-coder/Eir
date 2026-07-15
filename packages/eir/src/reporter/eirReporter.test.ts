import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TestCase, TestResult } from "@playwright/test/reporter";
import { EirReporter } from "./eirReporter.js";
import type { SerializedPolicyEvent } from "../policy/policyLogFile.js";

const HEALED_EVENT: SerializedPolicyEvent = {
  kind: "heal-attempt",
  method: "click",
  route: "/dashboard/devices",
  selectorKey: 'getByTestId("device-row-remove")',
  matchAttempt: {
    kind: "matched",
    fingerprint: {
      v: 1,
      tag: "button",
      attrs: {},
      text: "Remove",
      label: null,
      ancestors: [],
      siblingIndex: 0,
      siblingCount: 1,
      bbox: { x: 0, y: 0, w: 1, h: 1 },
    },
    candidateCount: 1,
    winner: {
      tag: "button",
      attrs: {},
      text: "Remove",
      label: null,
      ancestors: [],
      siblingIndex: 0,
      siblingCount: 1,
      bbox: { x: 0, y: 0, w: 1, h: 1 },
    },
    breakdown: {
      attrOverlap: 1,
      textSimilarity: 1,
      labelMatch: 1,
      ancestorChain: 1,
      siblingPosition: 1,
      bboxProximity: 1,
    },
    confidence: 0.91,
    margin: 0.4,
    suggestion: { kind: "data-testid", description: 'getByTestId("device-row-remove-v2")' },
    winnerLocator: { selector: "button", domIndex: 0 },
    shortlist: [],
  },
  action: { kind: "heal-and-continue" },
  retryOutcome: { kind: "healed" },
  screenshotBase64: null,
  fallback: null,
};

const DRIFT_EVENT: SerializedPolicyEvent = {
  kind: "drift-suspected",
  method: "click",
  route: "/dashboard/devices",
  selectorKey: "tbody tr:nth-child(1)",
  score: 0.42,
};

function fakeTest(title: string): TestCase {
  return { title } as unknown as TestCase;
}

function fakeResult(
  attachments: TestResult["attachments"],
): TestResult {
  return { attachments } as unknown as TestResult;
}

function jsonAttachment(name: string, event: SerializedPolicyEvent): TestResult["attachments"][number] {
  return { name, contentType: "application/json", body: Buffer.from(JSON.stringify(event)) };
}

function screenshotAttachment(name: string): TestResult["attachments"][number] {
  return { name, contentType: "image/png", body: Buffer.from("fake-png-bytes") };
}

describe("EirReporter", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "eir-reporter-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes eir-report.json with a healed row, including confidence and suggestion", async () => {
    const reporter = new EirReporter({ outputDir: dir });
    reporter.onTestEnd(fakeTest("removes a device"), fakeResult([jsonAttachment("eir-policy-event:0", HEALED_EVENT)]));
    await reporter.onEnd();

    const json = JSON.parse(await readFile(path.join(dir, "eir-report.json"), "utf8")) as {
      rows: unknown[];
    };
    expect(json.rows).toEqual([
      {
        testTitle: "removes a device",
        method: "click",
        route: "/dashboard/devices",
        selectorKey: 'getByTestId("device-row-remove")',
        action: "healed",
        confidence: 0.91,
        suggestion: 'getByTestId("device-row-remove-v2")',
        screenshotFile: null,
        fallback: null,
      },
    ]);
  });

  it("writes a paired screenshot file and links it from the row", async () => {
    const reporter = new EirReporter({ outputDir: dir });
    reporter.onTestEnd(
      fakeTest("removes a device"),
      fakeResult([jsonAttachment("eir-policy-event:0", HEALED_EVENT), screenshotAttachment("eir-heal-screenshot:0")]),
    );
    await reporter.onEnd();

    const json = JSON.parse(await readFile(path.join(dir, "eir-report.json"), "utf8")) as {
      rows: { screenshotFile: string | null }[];
    };
    const screenshotFile = json.rows[0]?.screenshotFile;
    expect(screenshotFile).not.toBeNull();
    expect(screenshotFile).toMatch(/^screenshots\/.*\.png$/);

    const bytes = await readFile(path.join(dir, screenshotFile as string));
    expect(bytes.toString("utf8")).toBe("fake-png-bytes");
  });

  it("classifies a drift-suspected event distinctly, with its score as confidence", async () => {
    const reporter = new EirReporter({ outputDir: dir });
    reporter.onTestEnd(fakeTest("click a reordered row"), fakeResult([jsonAttachment("eir-policy-event:0", DRIFT_EVENT)]));
    await reporter.onEnd();

    const json = JSON.parse(await readFile(path.join(dir, "eir-report.json"), "utf8")) as {
      rows: { action: string; confidence: number }[];
    };
    expect(json.rows[0]?.action).toBe("drift-suspected");
    expect(json.rows[0]?.confidence).toBe(0.42);
  });

  it("classifies heal-rejected and heal-attempt-failed distinctly from healed", async () => {
    const rejected: SerializedPolicyEvent = {
      ...HEALED_EVENT,
      retryOutcome: { kind: "heal-rejected-post-condition-mismatch" },
    };
    const retryFailed: SerializedPolicyEvent = {
      ...HEALED_EVENT,
      retryOutcome: { kind: "heal-attempted-retry-failed" },
    };

    const reporter = new EirReporter({ outputDir: dir });
    reporter.onTestEnd(fakeTest("t1"), fakeResult([jsonAttachment("eir-policy-event:0", rejected)]));
    reporter.onTestEnd(fakeTest("t2"), fakeResult([jsonAttachment("eir-policy-event:0", retryFailed)]));
    await reporter.onEnd();

    const json = JSON.parse(await readFile(path.join(dir, "eir-report.json"), "utf8")) as {
      rows: { action: string }[];
    };
    expect(json.rows.map((r) => r.action)).toEqual(["heal-rejected", "heal-attempt-failed"]);
  });

  it("classifies fail-with-suggestion as suggested and fail-normally as missed", async () => {
    const suggested: SerializedPolicyEvent = {
      ...HEALED_EVENT,
      action: { kind: "fail-with-suggestion" },
      retryOutcome: { kind: "not-attempted" },
    };
    const missed: SerializedPolicyEvent = {
      ...HEALED_EVENT,
      action: { kind: "fail-normally" },
      retryOutcome: { kind: "not-attempted" },
    };

    const reporter = new EirReporter({ outputDir: dir });
    reporter.onTestEnd(fakeTest("t1"), fakeResult([jsonAttachment("eir-policy-event:0", suggested)]));
    reporter.onTestEnd(fakeTest("t2"), fakeResult([jsonAttachment("eir-policy-event:0", missed)]));
    await reporter.onEnd();

    const json = JSON.parse(await readFile(path.join(dir, "eir-report.json"), "utf8")) as {
      rows: { action: string }[];
    };
    expect(json.rows.map((r) => r.action)).toEqual(["suggested", "missed"]);
  });

  it("writes a clean, explicit eir-report.md when there is no heal-eligible activity", async () => {
    const reporter = new EirReporter({ outputDir: dir });
    await reporter.onEnd();

    const markdown = await readFile(path.join(dir, "eir-report.md"), "utf8");
    expect(markdown).toContain("No heal-eligible activity this run.");
  });

  it("writes a markdown table row per event, screenshot rendered as an image link", async () => {
    const reporter = new EirReporter({ outputDir: dir });
    reporter.onTestEnd(
      fakeTest("removes a device"),
      fakeResult([jsonAttachment("eir-policy-event:0", HEALED_EVENT), screenshotAttachment("eir-heal-screenshot:0")]),
    );
    await reporter.onEnd();

    const markdown = await readFile(path.join(dir, "eir-report.md"), "utf8");
    expect(markdown).toContain("removes a device");
    expect(markdown).toContain("healed");
    expect(markdown).toMatch(/!\[]\(screenshots\/.*\.png\)/);
  });
});
