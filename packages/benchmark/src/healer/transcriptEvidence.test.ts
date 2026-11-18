import { describe, expect, it } from "vitest";
import {
  firstActiveTableEvidence,
  firstArchivedClaim,
  toolResultTexts,
} from "./transcriptEvidence.js";

const result = (text: string): string =>
  JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", content: text }] } });
const assistant = (text: string): string =>
  JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text }] } });

describe("toolResultTexts", () => {
  it("returns string and structured results in order, skipping noise", () => {
    const jsonl = [result("one"), "not json", assistant("hi"), result("two")].join("\n");
    expect(toolResultTexts(jsonl)).toEqual(["one", "two"]);
  });
});

describe("firstActiveTableEvidence (synthetic strings; the real transcripts are gitignored)", () => {
  const withRow =
    'heading "Active Devices"\nrow "Warehouse Scanner K. Nguyen"\nheading "Archived Devices"\nrow "Legacy"';
  const withoutRow =
    'heading "Active Devices"\nrow "Conference Room Display S. Patel"\nheading "Archived Devices"\nrow "Legacy K. Nguyen"';

  it("present when the row is in the active section", () => {
    expect(firstActiveTableEvidence([withRow], "K. Nguyen", "Warehouse Scanner")).toBe("present");
  });
  it("missing when the owner appears only under Archived Devices", () => {
    expect(firstActiveTableEvidence([withoutRow], "K. Nguyen", "Warehouse Scanner")).toBe(
      "missing",
    );
  });
  it("uses the first result that shows the table", () => {
    expect(
      firstActiveTableEvidence(
        ["no table here", withoutRow, withRow],
        "K. Nguyen",
        "Warehouse Scanner",
      ),
    ).toBe("missing");
  });
  it("no-evidence when no result shows the table", () => {
    expect(firstActiveTableEvidence(["nothing"], "K. Nguyen", "Warehouse Scanner")).toBe(
      "no-evidence",
    );
  });
  it("reads yaml-escaped newlines", () => {
    expect(
      firstActiveTableEvidence(
        ["x Active Devices\\n K. Nguyen \\n Archived Devices"],
        "K. Nguyen",
        "W",
      ),
    ).toBe("present");
  });
});

describe("firstArchivedClaim", () => {
  it("returns the first assistant text that mentions the archived table", () => {
    expect(
      firstArchivedClaim(
        [assistant("Looking."), assistant("K. Nguyen is in the archived table.")].join("\n"),
      ),
    ).toBe("K. Nguyen is in the archived table.");
  });
  it("undefined when there is none", () => {
    expect(firstArchivedClaim(assistant("nothing relevant"))).toBeUndefined();
  });
});
