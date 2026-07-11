import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PostCondition } from "../postCondition.js";
import { PostConditionStore } from "./postConditionStore.js";
import { postConditionShardFilePath } from "./paths.js";
import { postConditionStoreToShardPayload, writePostConditionShard } from "./postConditionShardWriter.js";

const SAMPLE: PostCondition = { v: 1, kind: "route-change", toRoute: "/dashboard/devices" };

describe("postConditionStoreToShardPayload", () => {
  it("keys by post-condition filename (sibling of the fingerprint's), not the raw route string", () => {
    const store = new PostConditionStore();
    store.record("/plan/:id/edit", "key", SAMPLE);

    expect(postConditionStoreToShardPayload(store)).toEqual({
      "plan__id__edit.postconditions.json": { key: SAMPLE },
    });
  });
});

describe("writePostConditionShard", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "eir-pc-shard-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes a shard file for a non-empty store, in its own shard directory", async () => {
    const store = new PostConditionStore();
    store.record("/login", "key", SAMPLE);

    await writePostConditionShard(store, 0, dir);

    const content = JSON.parse(await readFile(postConditionShardFilePath(0, dir), "utf8")) as unknown;
    expect(content).toEqual({ "login.postconditions.json": { key: SAMPLE } });
  });

  it("writes nothing for an empty store", async () => {
    await writePostConditionShard(new PostConditionStore(), 0, dir);
    await expect(readFile(postConditionShardFilePath(0, dir), "utf8")).rejects.toThrow();
  });
});
