import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Fingerprint } from "../fingerprint.js";
import { FingerprintStore } from "./fingerprintStore.js";
import { shardFilePath } from "./paths.js";
import { storeToShardPayload, writeShard } from "./shardWriter.js";

function sampleFingerprint(): Fingerprint {
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
  };
}

describe("storeToShardPayload", () => {
  it("keys by filename, not the raw route string", () => {
    const store = new FingerprintStore();
    store.record("/plan/:id/edit", "key", sampleFingerprint());

    expect(storeToShardPayload(store)).toEqual({
      "plan__id__edit.json": { key: sampleFingerprint() },
    });
  });
});

describe("writeShard", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "eir-shard-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes a shard file for a non-empty store", async () => {
    const store = new FingerprintStore();
    store.record("/login", "key", sampleFingerprint());

    await writeShard(store, 0, dir);

    const content = JSON.parse(await readFile(shardFilePath(0, dir), "utf8")) as unknown;
    expect(content).toEqual({ "login.json": { key: sampleFingerprint() } });
  });

  it("writes nothing for an empty store", async () => {
    await writeShard(new FingerprintStore(), 0, dir);
    await expect(readFile(shardFilePath(0, dir), "utf8")).rejects.toThrow();
  });
});
