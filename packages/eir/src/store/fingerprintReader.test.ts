import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Fingerprint } from "../fingerprint.js";
import { BaselineFingerprintReader, loadFingerprintReader } from "./fingerprintReader.js";
import { routesDir } from "./paths.js";
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

describe("BaselineFingerprintReader", () => {
  it("looks up a fingerprint by (route, selectorKey)", () => {
    const reader = new BaselineFingerprintReader({
      "dashboard__devices.json": { "getByTestId(x)": sampleFingerprint() },
    });
    expect(reader.lookup("/dashboard/devices", "getByTestId(x)")).toEqual(sampleFingerprint());
  });

  it("returns undefined for a route that was never captured (Gate 1's onboarding case)", () => {
    const reader = new BaselineFingerprintReader({});
    expect(reader.lookup("/never/seen", "getByTestId(x)")).toBeUndefined();
  });

  it("returns undefined for a known route but unknown selector key", () => {
    const reader = new BaselineFingerprintReader({
      "login.json": { "getByTestId(known)": sampleFingerprint() },
    });
    expect(reader.lookup("/login", "getByTestId(unknown)")).toBeUndefined();
  });
});

describe("loadFingerprintReader", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "eir-reader-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("loads the committed baseline from disk and makes it queryable", async () => {
    await mkdir(routesDir(dir), { recursive: true });
    await writeFile(
      path.join(routesDir(dir), "login.json"),
      stableStringify({ "getByTestId(login-username)": sampleFingerprint({ text: "Username" }) }),
    );

    const reader = await loadFingerprintReader(dir);
    expect(reader.lookup("/login", "getByTestId(login-username)")).toEqual(
      sampleFingerprint({ text: "Username" }),
    );
  });

  it("returns a reader with nothing loaded when no baseline exists yet", async () => {
    const reader = await loadFingerprintReader(dir);
    expect(reader.lookup("/login", "anything")).toBeUndefined();
  });
});
