import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Fingerprint } from "../fingerprint.js";
import { loadRouteFiles } from "./loadRouteFiles.js";
import { stableStringify } from "./stableStringify.js";

function sampleFingerprint(overrides: Partial<Fingerprint> = {}): Fingerprint {
  return {
    v: 1,
    tag: "button",
    attrs: {},
    text: "Save",
    label: null,
    ancestors: [],
    siblingIndex: 0,
    siblingCount: 1,
    bbox: { x: 0, y: 0, w: 32, h: 32 },
    ...overrides,
  };
}

describe("loadRouteFiles", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "eir-load-routes-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns an empty object when the directory doesn't exist", async () => {
    await expect(loadRouteFiles(path.join(dir, "missing"))).resolves.toEqual({});
  });

  it("reads every valid route file, keyed by filename", async () => {
    await writeFile(
      path.join(dir, "login.json"),
      stableStringify({ "getByTestId(login-username)": sampleFingerprint() }),
    );
    await writeFile(
      path.join(dir, "dashboard__devices.json"),
      stableStringify({ "getByTestId(x)": sampleFingerprint({ text: "X" }) }),
    );

    const result = await loadRouteFiles(dir);
    expect(Object.keys(result).sort()).toEqual(["dashboard__devices.json", "login.json"]);
    expect(result["login.json"]?.["getByTestId(login-username)"]).toEqual(sampleFingerprint());
  });

  it("skips non-JSON files and malformed/hand-edited route files rather than throwing", async () => {
    await writeFile(path.join(dir, "notes.txt"), "irrelevant");
    await writeFile(path.join(dir, "corrupt.json"), stableStringify({ x: { not: "a fingerprint" } }));
    await writeFile(
      path.join(dir, "good.json"),
      stableStringify({ "locator(#x)": sampleFingerprint() }),
    );

    const result = await loadRouteFiles(dir);
    expect(Object.keys(result)).toEqual(["good.json"]);
  });
});
