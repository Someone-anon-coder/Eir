import { describe, expect, it } from "vitest";
import type { Fingerprint } from "../fingerprint.js";
import { FingerprintStore, routeMapToPlainObject } from "./fingerprintStore.js";

function sampleFingerprint(overrides: Partial<Fingerprint> = {}): Fingerprint {
  return {
    v: 1,
    tag: "button",
    attrs: { id: "save-btn" },
    text: "Save",
    label: null,
    ancestors: [],
    siblingIndex: 0,
    siblingCount: 1,
    bbox: { x: 0, y: 0, w: 32, h: 32 },
    ...overrides,
  };
}

describe("FingerprintStore", () => {
  it("records a fingerprint under its route and selector key", () => {
    const store = new FingerprintStore();
    store.record("/dashboard/devices", 'getByTestId("device-row-edit")', sampleFingerprint());

    expect(store.routes.get("/dashboard/devices")?.get('getByTestId("device-row-edit")')).toEqual(
      sampleFingerprint(),
    );
  });

  it("last write wins for the same route+selector key", () => {
    const store = new FingerprintStore();
    store.record("/dashboard/devices", "key", sampleFingerprint({ text: "first" }));
    store.record("/dashboard/devices", "key", sampleFingerprint({ text: "second" }));

    expect(store.routes.get("/dashboard/devices")?.get("key")?.text).toBe("second");
  });

  it("keeps separate routes independent", () => {
    const store = new FingerprintStore();
    store.record("/login", "key", sampleFingerprint());
    store.record("/dashboard/devices", "key", sampleFingerprint());

    expect(store.routes.size).toBe(2);
  });

  it("waitForPending resolves once every tracked capture has settled", async () => {
    const store = new FingerprintStore();
    let resolveCapture: () => void = () => {};
    const capture = new Promise<void>((resolve) => {
      resolveCapture = resolve;
    });
    store.trackPending(capture);

    let settled = false;
    const waiting = store.waitForPending().then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    resolveCapture();
    await waiting;
    expect(settled).toBe(true);
  });

  it("waitForPending never rejects, even if a tracked capture does", async () => {
    const store = new FingerprintStore();
    store.trackPending(Promise.reject(new Error("boom")));

    await expect(store.waitForPending()).resolves.toBeUndefined();
  });

  it("waitForPending also drains captures registered while it was already waiting", async () => {
    const store = new FingerprintStore();
    let resolveFirst: () => void = () => {};
    const first = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    store.trackPending(first);

    let secondRegistered = false;
    const waiting = store.waitForPending();

    resolveFirst();
    store.trackPending(
      new Promise<void>((resolve) => {
        secondRegistered = true;
        resolve();
      }),
    );

    await waiting;
    expect(secondRegistered).toBe(true);
  });
});

describe("routeMapToPlainObject", () => {
  it("converts nested Maps into plain nested objects", () => {
    const store = new FingerprintStore();
    store.record("/login", 'getByTestId("submit")', sampleFingerprint());

    expect(routeMapToPlainObject(store.routes)).toEqual({
      "/login": { 'getByTestId("submit")': sampleFingerprint() },
    });
  });

  it("returns an empty object for an empty store", () => {
    expect(routeMapToPlainObject(new FingerprintStore().routes)).toEqual({});
  });
});
