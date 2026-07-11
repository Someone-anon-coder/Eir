import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Fingerprint } from "../fingerprint.js";
import type { PostCondition } from "../postCondition.js";
import { BaselinePostConditionReader, loadPostConditionReader } from "./postConditionReader.js";
import { routesDir } from "./paths.js";
import { stableStringify } from "./stableStringify.js";

const SAMPLE_POST_CONDITION: PostCondition = { v: 1, kind: "dom-count-change", sign: "decreased" };

const SAMPLE_FINGERPRINT: Fingerprint = {
  v: 1,
  tag: "button",
  attrs: {},
  text: "Remove",
  label: null,
  ancestors: [],
  siblingIndex: 0,
  siblingCount: 1,
  bbox: { x: 0, y: 0, w: 32, h: 32 },
};

describe("BaselinePostConditionReader", () => {
  it("looks up a post-condition by (route, selectorKey)", () => {
    const reader = new BaselinePostConditionReader({
      "dashboard__devices.postconditions.json": { "getByTestId(x)": SAMPLE_POST_CONDITION },
    });
    expect(reader.lookup("/dashboard/devices", "getByTestId(x)")).toEqual(SAMPLE_POST_CONDITION);
  });

  it("returns undefined when no post-condition was ever captured for this selector", () => {
    expect(new BaselinePostConditionReader({}).lookup("/never/seen", "x")).toBeUndefined();
  });
});

describe("loadPostConditionReader", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "eir-pc-reader-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("loads the committed post-condition baseline from disk", async () => {
    await mkdir(routesDir(dir), { recursive: true });
    await writeFile(
      path.join(routesDir(dir), "login.postconditions.json"),
      stableStringify({ "getByTestId(submit)": SAMPLE_POST_CONDITION }),
    );

    const reader = await loadPostConditionReader(dir);
    expect(reader.lookup("/login", "getByTestId(submit)")).toEqual(SAMPLE_POST_CONDITION);
  });

  it("never confuses a co-located Fingerprint route file for a post-condition one", async () => {
    await mkdir(routesDir(dir), { recursive: true });
    await writeFile(
      path.join(routesDir(dir), "login.json"),
      stableStringify({ "getByTestId(submit)": SAMPLE_FINGERPRINT }),
    );
    await writeFile(
      path.join(routesDir(dir), "login.postconditions.json"),
      stableStringify({ "getByTestId(submit)": SAMPLE_POST_CONDITION }),
    );

    const reader = await loadPostConditionReader(dir);
    expect(reader.lookup("/login", "getByTestId(submit)")).toEqual(SAMPLE_POST_CONDITION);
  });

  it("returns a reader with nothing loaded when no baseline exists yet", async () => {
    const reader = await loadPostConditionReader(dir);
    expect(reader.lookup("/login", "anything")).toBeUndefined();
  });
});
