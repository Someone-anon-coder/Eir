import { describe, expect, it } from "vitest";
import { REPORT_MARKER, bodyHasMarker } from "./marker.js";

describe("bodyHasMarker", () => {
  const cases: readonly [string, string, boolean][] = [
    ["exact marker present", `## Eir report\n\nfoo\n\n${REPORT_MARKER}`, true],
    ["marker present mid-body", `${REPORT_MARKER}\nsome trailing text`, true],
    ["no marker at all", "## Eir report\n\nfoo", false],
    ["a different bot's marker", "<!-- some-other-bot:v1 -->", false],
    ["empty body", "", false],
    ["marker substring but wrong version", "<!-- eir-report:v2 -->", false],
  ];

  it.each(cases)("%s", (_label, body, expected) => {
    expect(bodyHasMarker(body)).toBe(expected);
  });
});
