import { describe, expect, it } from "vitest";
import { candidateSelector } from "./candidateSelector.js";

describe("candidateSelector", () => {
  it.each(["button", "a"])("expands %s into the full button-like swap group", (tag) => {
    const selector = candidateSelector(tag, undefined);
    expect(selector).toContain("button");
    expect(selector).toContain("a");
    expect(selector).toContain("input[type=submit]");
    expect(selector).toContain("input[type=button]");
  });

  it.each(["submit", "button"])("expands an input[type=%s] into the button-like swap group too", (type) => {
    const selector = candidateSelector("input", type);
    expect(selector).toContain("button");
    expect(selector).toContain("input[type=submit]");
  });

  it.each(["text", "password", "email", "checkbox", "radio"])(
    "does NOT expand an input[type=%s] into the button-like group — it's not a button-like control",
    (type) => {
      expect(candidateSelector("input", type)).toBe("input");
    },
  );

  it("searches plain 'input' broadly (all types) when the fingerprint captured no type at all", () => {
    // Real bug found via a live benchmark run: treating every <input> as
    // swap-equivalent to buttons meant a plain input[type=text]'s own
    // candidate query excluded input[type=text] entirely — the renamed
    // field was silently absent from its own candidate pool.
    expect(candidateSelector("input", undefined)).toBe("input");
  });

  it("leaves an unrelated tag untouched", () => {
    expect(candidateSelector("select", undefined)).toBe("select");
  });
});
