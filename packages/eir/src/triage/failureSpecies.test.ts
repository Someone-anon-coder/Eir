import { describe, expect, it } from "vitest";
import { classifyFailureSpecies } from "./failureSpecies.js";

// Real message text, captured from a spike against Ward (zero-match,
// found-but-never-visible) and traced through playwright-core's own
// source (detached) — see failureSpecies.ts's docstring.

const ZERO_MATCH_MESSAGE = `locator.click: Timeout 1500ms exceeded.
Call log:
  - waiting for locator('#does-not-exist')
`;

const FOUND_BUT_NEVER_VISIBLE_MESSAGE = `locator.click: Timeout 1500ms exceeded.
Call log:
  - waiting for locator('#hidden-btn')
    - locator resolved to <button id="hidden-btn">Hidden</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
`;

const DETACHED_MESSAGE = "Element is not attached to the DOM";

describe("classifyFailureSpecies", () => {
  it("classifies a locator that never resolved as zero-match", () => {
    expect(classifyFailureSpecies(ZERO_MATCH_MESSAGE)).toBe("zero-match");
  });

  it("classifies a resolved-but-never-actionable element as found-but-never-visible", () => {
    expect(classifyFailureSpecies(FOUND_BUT_NEVER_VISIBLE_MESSAGE)).toBe("found-but-never-visible");
  });

  it("classifies playwright-core's non-retriable detach error as detached", () => {
    expect(classifyFailureSpecies(DETACHED_MESSAGE)).toBe("detached");
  });

  it("classifies a detached message even when prefixed with an API call name", () => {
    expect(classifyFailureSpecies("locator.click: Element is not attached to the DOM")).toBe(
      "detached",
    );
  });

  it("classifies an unrecognized message shape as unknown, never heal-eligible by default", () => {
    expect(classifyFailureSpecies("some unrelated application error")).toBe("unknown");
  });
});
