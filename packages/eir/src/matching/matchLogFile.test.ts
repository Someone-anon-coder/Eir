import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendMatchLogFile } from "./matchLogFile.js";
import type { MatchLogEntry } from "./matchLog.js";

const SAMPLE_ENTRY: MatchLogEntry = {
  method: "click",
  route: "/dashboard/devices",
  selectorKey: 'getByTestId("device-row-remove")',
  result: { kind: "no-candidates", fingerprint: { v: 1, tag: "button", attrs: {}, text: null, label: null, ancestors: [], siblingIndex: 0, siblingCount: 1, bbox: { x: 0, y: 0, w: 0, h: 0 } } },
};

describe("appendMatchLogFile", () => {
  let dir: string;
  const originalEnv = process.env["EIR_MATCH_LOG_FILE"];

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "eir-matchlog-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    if (originalEnv === undefined) {
      delete process.env["EIR_MATCH_LOG_FILE"];
    } else {
      process.env["EIR_MATCH_LOG_FILE"] = originalEnv;
    }
  });

  it("is a no-op when EIR_MATCH_LOG_FILE isn't set (real users never pay this cost)", async () => {
    delete process.env["EIR_MATCH_LOG_FILE"];
    await expect(appendMatchLogFile("some test", [SAMPLE_ENTRY])).resolves.toBeUndefined();
  });

  it("is a no-op when there are no attempts to record", async () => {
    const filePath = path.join(dir, "log.jsonl");
    process.env["EIR_MATCH_LOG_FILE"] = filePath;
    await appendMatchLogFile("some test", []);
    await expect(readFile(filePath, "utf8")).rejects.toThrow();
  });

  it("appends one JSON line per call, tagged with the test title", async () => {
    const filePath = path.join(dir, "log.jsonl");
    process.env["EIR_MATCH_LOG_FILE"] = filePath;

    await appendMatchLogFile("target-a", [SAMPLE_ENTRY]);
    await appendMatchLogFile("target-b", [SAMPLE_ENTRY]);

    const lines = (await readFile(filePath, "utf8")).trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] ?? "")).toEqual({ testTitle: "target-a", attempts: [SAMPLE_ENTRY] });
    expect(JSON.parse(lines[1] ?? "")).toEqual({ testTitle: "target-b", attempts: [SAMPLE_ENTRY] });
  });
});
