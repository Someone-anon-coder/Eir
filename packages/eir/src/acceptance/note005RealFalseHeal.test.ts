import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { chromium, type Browser, type Page } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EirLocator } from "../eirLocator.js";
import type { Fingerprint } from "../fingerprint.js";
import type { Annotate, MatchingContext } from "../matching/context.js";
import { MatchLog } from "../matching/matchLog.js";
import type { PostCondition } from "../postCondition.js";
import { PolicyLog } from "../policy/policyLog.js";
import { DEFAULT_HEAL_THRESHOLD } from "../policy/thresholds.js";
import type { FingerprintReader } from "../store/fingerprintReader.js";
import { FingerprintStore, type RouteMap } from "../store/fingerprintStore.js";
import type { PostConditionReader } from "../store/postConditionReader.js";
import {
  PostConditionStore,
  type PostConditionRouteMap,
} from "../store/postConditionStore.js";

/**
 * NOTE-005 (Phase 9 hardening, mandatory fix): Mechanism A (post-condition
 * verification) shipped in Phase 6 unit-tested only against a mocked
 * matcher — it had never caught a real wrong heal produced end-to-end by
 * the actual matching engine. This test constructs exactly that: a real
 * browser DOM, the real (unmocked) `attemptMatch` funnel, the real (six)
 * scorers, and a real `EirLocator#retryHealed` retry — deliberately
 * configured with a permissive `healThreshold` so a genuine false heal
 * fires, then asserts Mechanism A's `postConditionMatches` catches it.
 *
 * This does NOT contradict the project's measured 0.0% false-heal rate
 * (docs/tuning-log.md, packages/benchmark/reports/baseline.md) — that
 * number holds at the *shipped default* thresholds (0.7 / 0.05 margin).
 * This test deliberately configures `healThreshold` far below that
 * default specifically to force the acceptance path so Mechanism A's
 * rejection can be observed live, exactly as NOTE-005 asked for. It is a
 * statement about the safety net, not about default behavior.
 *
 * Scenario (a real near-duplicate pair, transplanted from BLUEPRINT.md's
 * own Login/Signup motivating example for NOTE-001): two adjacent,
 * same-tag, same-container buttons differing mainly in identifying
 * attributes and text. The *real* target ("Delete Item") removes a DOM
 * node when clicked — a genuine, observable post-condition
 * (`dom-count-change: decreased`). The distractor ("Archive Item") is
 * structurally near-identical but *adds* a node when clicked
 * (`dom-count-change: increased`) — the opposite, unmistakable signal.
 * After "Delete Item" is removed from the DOM (simulating the mutation
 * that would trigger healing), only "Archive Item" remains as a
 * same-tag candidate, so the matcher's decision margin trivially equals
 * its confidence (Blueprint §7.5 — margin is winner-minus-runner-up, and
 * equals the winner's own score when there is no runner-up).
 */

const PAGE_HTML = `
<!doctype html>
<html>
  <body>
    <div id="toolbar">
      <button id="delete-item-btn" data-testid="delete-item-btn" type="button">Delete Item</button>
      <button id="archive-item-btn" data-testid="archive-item-btn" type="button">Archive Item</button>
    </div>
    <div id="pending-item">A pending item</div>
    <div id="archive-log"></div>
    <script>
      document.getElementById("delete-item-btn").addEventListener("click", () => {
        document.getElementById("pending-item")?.remove();
      });
      document.getElementById("archive-item-btn").addEventListener("click", () => {
        const entry = document.createElement("span");
        entry.textContent = "archived";
        document.getElementById("archive-log").appendChild(entry);
      });
    </script>
  </body>
</html>
`;

class DirectFingerprintReader implements FingerprintReader {
  constructor(private readonly routes: RouteMap) {}
  lookup(route: string, selectorKey: string): Fingerprint | undefined {
    return this.routes.get(route)?.get(selectorKey);
  }
}

class DirectPostConditionReader implements PostConditionReader {
  constructor(private readonly routes: PostConditionRouteMap) {}
  lookup(route: string, selectorKey: string): PostCondition | undefined {
    return this.routes.get(route)?.get(selectorKey);
  }
}

/** Deliberately far below `DEFAULT_HEAL_THRESHOLD` (0.7) — see the module docstring for why this is honest, not a claim about safe defaults. */
const DELIBERATELY_PERMISSIVE_HEAL_THRESHOLD = 0.2;

describe("NOTE-005: Mechanism A catches a real, live, engine-produced false heal", () => {
  let browser: Browser;
  let page: Page;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // A real HTTP navigation, not page.setContent() — Gate 2 (`isPageSane`)
    // treats "about:blank" as never sane by design (a real-looking blank
    // page usually means "haven't navigated yet"), so the triage funnel
    // needs a genuine URL to reason about, same as it would in Ward.
    server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(PAGE_HTML);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${String(address.port)}/`;

    browser = await chromium.launch();
    page = await browser.newPage();
    await page.goto(baseUrl);
  });

  afterAll(async () => {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("rejects a confidently-wrong heal-and-continue retry via post-condition mismatch", async () => {
    // --- Phase A: calibration — a real, successful click on the real target. ---
    const calibrationStore = new FingerprintStore();
    const calibrationPostConditionStore = new PostConditionStore();
    const calibrationAnnotations: { type: string; description?: string }[] = [];
    const calibrationAnnotate: Annotate = (type, description) => {
      calibrationAnnotations.push({ type, description });
    };

    const calibrationContext: MatchingContext = {
      reader: { lookup: () => undefined },
      log: new MatchLog(),
      postConditionReader: { lookup: () => undefined },
      mode: { mode: "suggest-only" },
      policyLog: new PolicyLog(),
      annotate: calibrationAnnotate,
      fallback: null,
    };

    const deleteLocator = new EirLocator(
      page.getByTestId("delete-item-btn"),
      [{ method: "getByTestId", args: ["delete-item-btn"] }],
      calibrationStore,
      calibrationPostConditionStore,
      calibrationContext,
    );

    expect(await page.locator("#pending-item").count()).toBe(1);
    await deleteLocator.click();
    expect(await page.locator("#pending-item").count()).toBe(0); // the real, genuine effect of the correct action

    // #recordCapture/#recordPostCondition are fire-and-forget — drain them
    // before reading the store back, exactly as worker teardown does.
    await calibrationStore.waitForPending();
    await calibrationPostConditionStore.waitForPending();

    const storedFingerprint = new DirectFingerprintReader(calibrationStore.routes);
    const storedPostCondition = new DirectPostConditionReader(calibrationPostConditionStore.routes);

    // Sanity check on the calibration itself, before using it as a baseline
    // — read back whatever route/selectorKey the real store actually used
    // (rather than hand-guessing the normalization), so the rest of the
    // test addresses it identically.
    const [calibratedRoute] = [...calibrationStore.routes.keys()];
    if (calibratedRoute === undefined) throw new Error("calibration produced no fingerprint at all");
    const [calibratedSelectorKey] = [...(calibrationStore.routes.get(calibratedRoute)?.keys() ?? [])];
    if (calibratedSelectorKey === undefined) throw new Error("calibration produced no selector key");

    expect(storedFingerprint.lookup(calibratedRoute, calibratedSelectorKey)).toBeDefined();
    expect(storedPostCondition.lookup(calibratedRoute, calibratedSelectorKey)).toEqual({
      v: 1,
      kind: "dom-count-change",
      sign: "decreased",
    });

    // --- Mutation: the real target vanishes; a near-duplicate remains. ---
    await page.evaluate(() => {
      document.getElementById("delete-item-btn")?.remove();
    });
    expect(await page.locator('[data-testid="delete-item-btn"]').count()).toBe(0);
    expect(await page.locator('[data-testid="archive-item-btn"]').count()).toBe(1);

    // --- Phase B: the real heal attempt, deliberately permissive threshold. ---
    const healPolicyLog = new PolicyLog();
    const healAnnotations: { type: string; description?: string }[] = [];
    const healAnnotate: Annotate = (type, description) => {
      healAnnotations.push({ type, description });
    };

    const healContext: MatchingContext = {
      reader: storedFingerprint,
      log: new MatchLog(),
      postConditionReader: storedPostCondition,
      mode: {
        mode: "heal",
        healThreshold: DELIBERATELY_PERMISSIVE_HEAL_THRESHOLD,
        suggestThreshold: 0.1,
      },
      policyLog: healPolicyLog,
      annotate: healAnnotate,
      fallback: null,
    };

    const healAttemptLocator = new EirLocator(
      page.getByTestId("delete-item-btn"), // the same, now-vanished selector
      [{ method: "getByTestId", args: ["delete-item-btn"] }],
      new FingerprintStore(), // record-mode capture during a heal attempt is irrelevant here; a fresh, unused store
      new PostConditionStore(),
      healContext,
    );

    // The original zero-match error must still be what the caller sees —
    // never the retry's own outcome, per Phase 6's retry-once contract.
    await expect(healAttemptLocator.click({ timeout: 1500 })).rejects.toThrow(/exceeded|timeout/i);

    // Prove the retry really happened against the real, wrong element —
    // not a hypothetical: "Archive Item" was really clicked, so its real
    // effect (a DOM node appended) really occurred.
    expect(await page.locator("#archive-log span").count()).toBe(1);

    // The real matcher really did decide to heal (not merely suggest) —
    // confirming the deliberately-lowered threshold did its job and this
    // is a genuine heal-and-continue attempt, not a suggestion-only path.
    const healAttemptEvents = healPolicyLog.events.filter((event) => event.kind === "heal-attempt");
    expect(healAttemptEvents).toHaveLength(1);
    const event = healAttemptEvents[0];
    if (event === undefined || event.kind !== "heal-attempt") throw new Error("unreachable");
    expect(event.action.kind).toBe("heal-and-continue");
    if (event.matchAttempt.kind !== "matched") throw new Error("expected a real match — got: " + event.matchAttempt.kind);
    expect(event.matchAttempt.confidence).toBeGreaterThanOrEqual(DELIBERATELY_PERMISSIVE_HEAL_THRESHOLD);
    // Measured at ~0.56: real, moderate-but-wrong confidence — comfortably
    // below the shipped DEFAULT_HEAL_THRESHOLD (0.7), confirming this scenario
    // needed the deliberately lowered threshold to fire at all; it is not a
    // claim that the shipped default would ever accept this heal.
    expect(event.matchAttempt.confidence).toBeLessThan(DEFAULT_HEAL_THRESHOLD);
    // Sole remaining candidate -> margin equals confidence (Blueprint §7.5 / aggregate.ts's decideMargin).
    expect(event.matchAttempt.margin).toBe(event.matchAttempt.confidence);

    // Mechanism A: the retry succeeded, but its real observed effect
    // (increased) contradicted the stored baseline (decreased) — this is
    // the live catch NOTE-005 asked for.
    expect(event.retryOutcome.kind).toBe("heal-rejected-post-condition-mismatch");

    // Visibly annotated, never silent (Blueprint P3).
    expect(healAnnotations.some((a) => a.type === "eir-heal-rejected")).toBe(true);
  });
});
