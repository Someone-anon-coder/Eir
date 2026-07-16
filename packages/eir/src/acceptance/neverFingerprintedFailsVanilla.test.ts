import { chromium, type Browser, type Page } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EirLocator } from "../eirLocator.js";
import { MatchLog } from "../matching/matchLog.js";
import { PolicyLog } from "../policy/policyLog.js";

/**
 * Blueprint §9.2: "A never-fingerprinted selector fails exactly as
 * vanilla Playwright would." Gate 1 (`triage/gates.ts`'s
 * `gateFingerprintExists`) already unit-tests the *decision* ("no
 * baseline -> rejected"); this proves the *observable outcome* a caller
 * actually sees — the same real browser, the same real selector, once
 * through vanilla Playwright and once through `EirLocator` with an
 * empty reader (no fingerprint ever recorded) — and asserts the thrown
 * error is the exact same message, not merely "also an error."
 */
describe("Blueprint §9.2: a never-fingerprinted selector fails exactly as vanilla Playwright would", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
    await page.setContent("<button>only button on the page</button>");
  });

  afterAll(async () => {
    await browser.close();
  });

  it("throws byte-identical error text, wrapped or not", async () => {
    let vanillaMessage: string | undefined;
    try {
      await page.locator("#does-not-exist").click({ timeout: 500 });
    } catch (error) {
      vanillaMessage = error instanceof Error ? error.message : String(error);
    }
    expect(vanillaMessage).toBeDefined();

    const eirLocator = new EirLocator(
      page.locator("#does-not-exist"),
      [{ method: "locator", args: ["#does-not-exist"] }],
      { record: () => {}, trackPending: () => {} },
      { record: () => {}, trackPending: () => {} },
      {
        reader: { lookup: () => undefined }, // no fingerprint ever recorded — Gate 1's exact case
        log: new MatchLog(),
        postConditionReader: { lookup: () => undefined },
        mode: { mode: "heal", healThreshold: 0.7, suggestThreshold: 0.3 }, // even in heal mode — Gate 1 rejects before mode is ever consulted
        policyLog: new PolicyLog(),
        annotate: () => {},
        fallback: null,
      },
    );

    let eirMessage: string | undefined;
    try {
      await eirLocator.click({ timeout: 500 });
    } catch (error) {
      eirMessage = error instanceof Error ? error.message : String(error);
    }

    expect(eirMessage).toBe(vanillaMessage);
  });
});
