import { describe, expect, it } from "vitest";
import { eirVersion } from "./index.js";

describe("eirVersion", () => {
  it("returns the version declared in package.json", () => {
    expect(eirVersion()).toBe("0.3.0");
  });
});
