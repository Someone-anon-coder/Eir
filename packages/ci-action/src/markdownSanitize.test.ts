import { describe, expect, it } from "vitest";
import { sanitizeForMarkdownCell } from "./markdownSanitize.js";

describe("sanitizeForMarkdownCell", () => {
  it("leaves an ordinary selector string untouched", () => {
    expect(sanitizeForMarkdownCell('getByTestId("device-row-edit")')).toBe(
      'getByTestId("device-row-edit")',
    );
  });

  it("escapes a pipe so it can't fragment a GFM table row", () => {
    expect(sanitizeForMarkdownCell("a | b")).toBe("a \\| b");
  });

  it("replaces a backtick with a fullwidth look-alike so it can't close a code span", () => {
    expect(sanitizeForMarkdownCell("a`b")).toBe("a｀b");
  });

  it("collapses embedded newlines and carriage returns to a single space", () => {
    expect(sanitizeForMarkdownCell("a\nb")).toBe("a b");
    expect(sanitizeForMarkdownCell("a\r\nb")).toBe("a b");
    expect(sanitizeForMarkdownCell("a\rb")).toBe("a b");
  });

  it("HTML-escapes angle brackets and ampersands so embedded markup renders as literal text", () => {
    expect(sanitizeForMarkdownCell("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
    expect(sanitizeForMarkdownCell("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("escapes & before introducing entities for < and >, avoiding double-escaping", () => {
    // If '&' were escaped after '<'/'>', this would become "&amp;lt;" instead
    // of the correct "&amp;lt;" — asserting the exact, single-pass result.
    expect(sanitizeForMarkdownCell("&lt;")).toBe("&amp;lt;");
  });

  // The exact hostile fixture that broke the rendered comment before this
  // fix existed: a backtick closing the code span early, a pipe fragmenting
  // the table into fake extra cells, a raw <script> tag, and an embedded
  // newline escaping the row into free-form comment body content.
  it("neutralizes a real hostile payload combining every attack in one string", () => {
    const hostile = 'getByTestId("a`) | INJECTED | <script>alert(1)</script>\ngetByTestId(evil")';
    const sanitized = sanitizeForMarkdownCell(hostile);

    expect(sanitized).not.toContain("`");
    expect(sanitized).toContain("\\|"); // pipe present only in its escaped form
    expect(sanitized).not.toMatch(/[^\\]\|/); // no bare, unescaped pipe anywhere
    expect(sanitized).not.toContain("<script>");
    expect(sanitized).not.toContain("\n");
    expect(sanitized.split("\n")).toHaveLength(1);
  });
});
