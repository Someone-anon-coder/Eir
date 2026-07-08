import type { Locator, Page } from "@playwright/test";
import type { MutationClass } from "./mutationClasses.js";

/**
 * Mirrors `packages/demo-app/src/mutation/overrides.ts`'s `MutationPayload`
 * shape. Duplicated rather than imported: `demo-app` has no `exports` map
 * (it's an app, not a library) and no built `dist/`, so there is no stable
 * "source of truth" module to import types from without deep-reaching into
 * another package's `src/` for convenience — exactly what CLAUDE.md §7.1
 * reserves for a package's own internal modules. The two shapes are kept
 * in sync by hand; they're small and change rarely.
 */
export interface OverridePayload {
  readonly attrs?: Readonly<Record<string, string>>;
  readonly text?: Readonly<Record<string, string>>;
  readonly tags?: Readonly<Record<string, "button" | "a">>;
  readonly wrap?: readonly string[];
  readonly order?: Readonly<Record<string, readonly number[]>>;
}

export type Interaction = (page: Page) => Promise<void>;

/**
 * Read-only counterpart to `Interaction`, used only by
 * `near-duplicate-sibling-swap` targets (Phase 5): resolves this target's
 * own live element *without clicking it*, so the benchmark can
 * independently read a distractor's live bounding box as ground truth for
 * "did Eir's matcher pick the right one or its near-duplicate twin?" —
 * never used to drive the probe itself. Necessarily has side effects of
 * its own where the demo app requires them (opening the delete-account
 * modal, entering a row's edit mode) — it only avoids the *specific*
 * click the matching `Interaction` performs.
 */
export type Locate = (page: Page) => Promise<Locator>;

export interface MutationTarget {
  /** Stable, unique, never reused across the registry. */
  readonly id: string;
  readonly mutationClass: MutationClass;
  /** Normalized route — matches Eir's `.eir/routes/*.json` bucket. */
  readonly route: string;
  /** Human-readable, documents which frozen selector this target breaks. */
  readonly frozenSelectorKey: string;
  /** The override fragment this target contributes when "live" this run. */
  readonly payload: OverridePayload;
  /** Performs the actual probe interaction using the frozen selector. */
  readonly interact: Interaction;
  /**
   * near-duplicate-sibling-swap only: the id of the *other* target in this
   * target's pair — the live, valid, structurally-similar sibling a future
   * matcher could plausibly (and wrongly) prefer. Phase 4 never runs or
   * scores the distractor; Phase 5's matcher is what would actually be at
   * risk of choosing it.
   */
  readonly distractorId?: string;
  /** near-duplicate-sibling-swap only — see `Locate`'s docstring. */
  readonly locate?: Locate;
}

// ---- shared interaction helpers -------------------------------------------

/**
 * Every target's `interact` reaches its own route through this shared
 * login step first — including the id-rename targets that mutate
 * `login.usernameInput`/`login.usernameInputId` themselves. Using
 * domProfile-driven selectors here would mean the *first* target to
 * mutate a login field breaks login for every other target in the same
 * run, for the wrong reason (can't even reach the page under test, not
 * "the mutated selector correctly failed"). `.login-page` is a real class
 * on `LoginPage.tsx` that is deliberately never wired to the mutation
 * override, so scoping through it — plus the `type="password"` /
 * `type="submit"` attributes, which are likewise never mutated — makes
 * this harness-internal step immune to every registered mutation class.
 */
async function login(page: Page): Promise<void> {
  await page.goto("/login");
  const form = page.locator(".login-page form");
  await form.locator('input:not([type="password"])').fill("aayush");
  await form.locator('input[type="password"]').fill("correct-horse");
  await form.locator('button[type="submit"]').click();
  await page.waitForURL("**/dashboard/devices");
}

async function arrive(page: Page, route: string): Promise<void> {
  await login(page);
  if (route !== "/dashboard/devices") {
    await page.goto(route);
  }
}

function clickTestId(route: string, testId: string): Interaction {
  return async (page) => {
    await arrive(page, route);
    await page.getByTestId(testId).click();
  };
}

function fillTestId(route: string, testId: string, value: string): Interaction {
  return async (page) => {
    await arrive(page, route);
    await page.getByTestId(testId).fill(value);
  };
}

function fillCssId(route: string, cssId: string, value: string): Interaction {
  return async (page) => {
    await arrive(page, route);
    await page.locator(`#${cssId}`).fill(value);
  };
}

// `exact: true` everywhere below is deliberate: Playwright's default
// getByRole/getByText name matching is a case-insensitive *substring*
// match, so a text-change replacement like "Provisioning" -> "Provisioning
// Requests" would otherwise still satisfy the frozen, pre-mutation query —
// the mutation would silently fail to register as broken. Exact matching
// is also the more honest simulation of "does an element with precisely
// this accessible name still exist."
function clickRole(route: string, role: "button" | "link", name: string): Interaction {
  return async (page) => {
    await arrive(page, route);
    await page.getByRole(role, { name, exact: true }).click();
  };
}

function fillLabel(route: string, label: string, value: string): Interaction {
  return async (page) => {
    await arrive(page, route);
    await page.getByLabel(label).fill(value);
  };
}

function clickClassScoped(route: string, cssSelector: string): Interaction {
  return async (page) => {
    await arrive(page, route);
    await page.locator(cssSelector).click();
  };
}

/** Scopes through a table's testid then a row matching `rowText`, both via the tracked `.locator()` capture point — never `.filter()`/`.and()` (RISK-004). */
function clickRowAction(
  route: string,
  tableTestId: string,
  rowText: string,
  actionTestId: string,
): Interaction {
  return async (page) => {
    await arrive(page, route);
    const row = page.getByTestId(tableTestId).locator("tr", { hasText: rowText });
    await row.getByTestId(actionTestId).click();
  };
}

/** Row-scoped by text, then a role+name button inside it — for Edit/Remove/Save/Cancel text-change and near-dup targets, which carry no testid of their own. */
function clickRowRoleButton(
  route: string,
  tableTestId: string,
  rowText: string,
  buttonName: string,
): Interaction {
  return async (page) => {
    await arrive(page, route);
    const row = page.getByTestId(tableTestId).locator("tr", { hasText: rowText });
    await row.getByRole("button", { name: buttonName, exact: true }).click();
  };
}

async function startEdit(page: Page, tableTestId: string, rowText: string): Promise<void> {
  const row = page.getByTestId(tableTestId).locator("tr", { hasText: rowText });
  await row.getByTestId("device-row-edit").click();
}

function clickEditModeButton(
  route: string,
  tableTestId: string,
  rowText: string,
  buttonName: string,
): Interaction {
  return async (page) => {
    await arrive(page, route);
    await startEdit(page, tableTestId, rowText);
    const row = page.getByTestId(tableTestId).locator("tr", { hasText: rowText });
    await row.getByRole("button", { name: buttonName, exact: true }).click();
  };
}

/** sibling-reorder: position-anchored via a CSS `:nth-child` *string* inside the tracked `.locator()` call — never Playwright's `.nth()`/`.first()`/`.last()` methods (RISK-004: those return untracked, unfingerprinted real Locators). */
function assertNthRowOwner(
  route: string,
  tableTestId: string,
  index: number,
  expectedOwner: string,
): Interaction {
  return async (page) => {
    await arrive(page, route);
    const owner = await page
      .locator(`[data-testid="${tableTestId}"] tbody tr:nth-child(${index}) td:nth-child(2)`)
      .innerText();
    if (owner !== expectedOwner) {
      throw new Error(
        `sibling-reorder probe: expected owner "${expectedOwner}" at row ${index}, found "${owner}"`,
      );
    }
  };
}

function assertFirstOptionValue(route: string, selectId: string, expectedValue: string): Interaction {
  return async (page) => {
    await arrive(page, route);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    const value = await page.locator(`#${selectId} option:first-child`).getAttribute("value");
    if (value !== expectedValue) {
      throw new Error(
        `sibling-reorder probe: expected first <option> value "${expectedValue}", found "${String(value)}"`,
      );
    }
  };
}

function clickActionsOrderFirst(
  route: string,
  tableTestId: string,
  rowText: string,
  expectedFirstActionName: string,
): Interaction {
  return async (page) => {
    await arrive(page, route);
    const row = page.getByTestId(tableTestId).locator("tr", { hasText: rowText });
    const firstAction = row.locator("td:nth-child(5) button:first-child");
    const name = await firstAction.innerText();
    if (name !== expectedFirstActionName) {
      throw new Error(
        `sibling-reorder probe: expected first action "${expectedFirstActionName}", found "${name}"`,
      );
    }
    await firstAction.click();
  };
}

// ---- read-only `locate` counterparts (Phase 5: near-duplicate-sibling-swap ground truth only) ----

function locateRowAction(
  route: string,
  tableTestId: string,
  rowText: string,
  actionTestId: string,
): Locate {
  return async (page) => {
    await arrive(page, route);
    const row = page.getByTestId(tableTestId).locator("tr", { hasText: rowText });
    return row.getByTestId(actionTestId);
  };
}

function locateRowRoleButton(
  route: string,
  tableTestId: string,
  rowText: string,
  buttonName: string,
): Locate {
  return async (page) => {
    await arrive(page, route);
    const row = page.getByTestId(tableTestId).locator("tr", { hasText: rowText });
    return row.getByRole("button", { name: buttonName, exact: true });
  };
}

/** Necessarily starts edit mode first (a real side effect) — Save/Cancel don't exist in the DOM otherwise. */
function locateEditModeButton(
  route: string,
  tableTestId: string,
  rowText: string,
  buttonName: string,
): Locate {
  return async (page) => {
    await arrive(page, route);
    await startEdit(page, tableTestId, rowText);
    const row = page.getByTestId(tableTestId).locator("tr", { hasText: rowText });
    return row.getByRole("button", { name: buttonName, exact: true });
  };
}

function locateLabelField(route: string, label: string): Locate {
  return async (page) => {
    await arrive(page, route);
    return page.getByLabel(label);
  };
}

/**
 * wrapper-inject: an exact-*depth* XPath (`parent::`) — Ward's real
 * ancestor-XPath selectors walk `ancestor::`, which is depth-agnostic by
 * design and survives wrapping; only an exact-hop axis actually
 * demonstrates this class. `expectedParent` names the element's *real*,
 * unwrapped parent precisely enough to distinguish it from the bare
 * `<div>` `wrapIfMutated` (demo-app) injects: a tag alone (`"section"`,
 * `"form"`) where no other div sits at that depth, or a tag qualified by
 * an attribute (`"div[@class='account-page']"`, `"div[@role='dialog']"`)
 * where the natural parent is itself a plain `<div>` and an unqualified
 * `parent::div` would match with or without the wrapper present.
 */
function fillViaExactParent(
  route: string,
  cssId: string,
  expectedParent: string,
  value: string,
): Interaction {
  return async (page) => {
    await arrive(page, route);
    await page
      .locator(`xpath=//*[@id='${cssId}']/parent::${expectedParent}`)
      .locator(`#${cssId}`)
      .fill(value);
  };
}

function clickViaExactParent(route: string, testId: string, expectedParent: string): Interaction {
  return async (page) => {
    await arrive(page, route);
    await page
      .locator(`xpath=//*[@data-testid='${testId}']/parent::${expectedParent}`)
      .getByTestId(testId)
      .click();
  };
}

// ---- id-rename -------------------------------------------------------------

const idRenameTargets: MutationTarget[] = [
  {
    id: "id-rename.login.usernameInputId",
    mutationClass: "id-rename",
    route: "/login",
    frozenSelectorKey: "locator(\"#login-username-input\")",
    payload: { attrs: { "login.usernameInputId": "login-username-input-mut" } },
    interact: fillCssId("/login", "login-username-input", "aayush"),
  },
  {
    id: "id-rename.login.passwordInputId",
    mutationClass: "id-rename",
    route: "/login",
    frozenSelectorKey: "locator(\"#login-password-input\")",
    payload: { attrs: { "login.passwordInputId": "login-password-input-mut" } },
    interact: fillCssId("/login", "login-password-input", "correct-horse"),
  },
  {
    id: "id-rename.login.usernameInput",
    mutationClass: "id-rename",
    route: "/login",
    frozenSelectorKey: 'getByTestId("login-username")',
    payload: { attrs: { "login.usernameInput": "login-username-mut" } },
    interact: fillTestId("/login", "login-username", "aayush"),
  },
  {
    id: "id-rename.provisioning.requesterNameInput",
    mutationClass: "id-rename",
    route: "/dashboard/provisioning",
    frozenSelectorKey: 'getByTestId("provisioning-requester-name")',
    payload: { attrs: { "provisioning.requesterNameInput": "provisioning-requester-name-mut" } },
    interact: fillTestId("/dashboard/provisioning", "provisioning-requester-name", "A. Ramirez"),
  },
  {
    id: "id-rename.provisioning.submitButton",
    mutationClass: "id-rename",
    route: "/dashboard/provisioning",
    frozenSelectorKey: 'getByTestId("provisioning-submit")',
    payload: { attrs: { "provisioning.submitButton": "provisioning-submit-mut" } },
    interact: clickTestId("/dashboard/provisioning", "provisioning-submit"),
  },
  {
    id: "id-rename.wizard.titleInput",
    mutationClass: "id-rename",
    route: "/dashboard/requests/new",
    frozenSelectorKey: 'getByTestId("wizard-title")',
    payload: { attrs: { "wizard.titleInput": "wizard-title-mut" } },
    interact: fillTestId("/dashboard/requests/new", "wizard-title", "New request"),
  },
  {
    id: "id-rename.wizard.requestedByInput",
    mutationClass: "id-rename",
    route: "/dashboard/requests/new",
    frozenSelectorKey: 'getByTestId("wizard-requested-by")',
    payload: { attrs: { "wizard.requestedByInput": "wizard-requested-by-mut" } },
    interact: fillTestId("/dashboard/requests/new", "wizard-requested-by", "A. Ramirez"),
  },
  {
    id: "id-rename.account.openDeleteButton",
    mutationClass: "id-rename",
    route: "/dashboard/account",
    frozenSelectorKey: 'getByTestId("open-delete-account")',
    payload: { attrs: { "account.openDeleteButton": "open-delete-account-mut" } },
    interact: clickTestId("/dashboard/account", "open-delete-account"),
  },
];

// ---- text-change ------------------------------------------------------------

const textChangeTargets: MutationTarget[] = [
  {
    id: "text-change.nav.provisioningLink",
    mutationClass: "text-change",
    route: "/dashboard/devices",
    frozenSelectorKey: 'getByRole("link", {"name":"Provisioning"})',
    payload: { text: { "nav.provisioningLink.text": "Provisioning Requests" } },
    interact: clickRole("/dashboard/devices", "link", "Provisioning"),
  },
  {
    id: "text-change.nav.logoutButton",
    mutationClass: "text-change",
    route: "/dashboard/devices",
    frozenSelectorKey: 'getByRole("button", {"name":"Log Out"})',
    payload: { text: { "nav.logoutButton.text": "Sign Out" } },
    interact: clickRole("/dashboard/devices", "button", "Log Out"),
  },
  {
    id: "text-change.nav.accountLink",
    mutationClass: "text-change",
    route: "/dashboard/devices",
    frozenSelectorKey: 'getByRole("link", {"name":"Account"})',
    payload: { text: { "nav.accountLink.text": "My Account" } },
    interact: clickRole("/dashboard/devices", "link", "Account"),
  },
  {
    id: "text-change.nav.requestsLink",
    mutationClass: "text-change",
    route: "/dashboard/devices",
    frozenSelectorKey: 'getByRole("link", {"name":"Access Requests"})',
    payload: { text: { "nav.requestsLink.text": "Requests" } },
    interact: clickRole("/dashboard/devices", "link", "Access Requests"),
  },
  {
    id: "text-change.account.openDeleteButton",
    mutationClass: "text-change",
    route: "/dashboard/account",
    frozenSelectorKey: 'getByRole("button", {"name":"Delete Account"})',
    payload: { text: { "account.openDeleteButton.text": "Remove Account" } },
    interact: clickRole("/dashboard/account", "button", "Delete Account"),
  },
  {
    id: "text-change.account.confirmButton",
    mutationClass: "text-change",
    route: "/dashboard/account",
    frozenSelectorKey: 'getByRole("button", {"name":"Confirm Delete"})',
    payload: { text: { "account.confirmButton.text": "Yes, Delete" } },
    interact: async (page) => {
      await arrive(page, "/dashboard/account");
      await page.getByRole("button", { name: "Delete Account", exact: true }).click();
      await page.getByRole("button", { name: "Confirm Delete", exact: true }).click();
    },
  },
  {
    id: "text-change.devices.archivedRowName",
    mutationClass: "text-change",
    route: "/dashboard/devices",
    frozenSelectorKey: 'getByText("Legacy Barcode Scanner")',
    payload: { text: { "devices.row.dev-10.editText": "Modify" } },
    interact: clickRowRoleButton(
      "/dashboard/devices",
      "table-archived-devices",
      "Legacy Barcode Scanner",
      "Edit",
    ),
  },
  {
    id: "text-change.wizard.nextButtonStep1",
    mutationClass: "text-change",
    route: "/dashboard/requests/new",
    frozenSelectorKey: 'getByTestId("wizard-next") (rendered text "Next")',
    payload: { text: { "wizard.nextButton.step1.text": "Continue" } },
    interact: clickRole("/dashboard/requests/new", "button", "Next"),
  },
];

// ---- tag-swap ---------------------------------------------------------------

const tagSwapTargets: MutationTarget[] = [
  {
    id: "tag-swap.nav.logoutButton",
    mutationClass: "tag-swap",
    route: "/dashboard/devices",
    frozenSelectorKey: 'getByRole("button", {"name":"Log Out"})',
    payload: { tags: { "nav.logoutButton.tag": "a" } },
    interact: clickRole("/dashboard/devices", "button", "Log Out"),
  },
  {
    id: "tag-swap.nav.devicesLink",
    mutationClass: "tag-swap",
    route: "/dashboard/devices",
    frozenSelectorKey: 'getByRole("link", {"name":"Devices"})',
    payload: { tags: { "nav.devicesLink.tag": "button" } },
    interact: clickRole("/dashboard/devices", "link", "Devices"),
  },
  {
    id: "tag-swap.nav.provisioningLink",
    mutationClass: "tag-swap",
    route: "/dashboard/devices",
    frozenSelectorKey: 'getByRole("link", {"name":"Provisioning"})',
    payload: { tags: { "nav.provisioningLink.tag": "button" } },
    interact: clickRole("/dashboard/devices", "link", "Provisioning"),
  },
  {
    id: "tag-swap.nav.accountLink",
    mutationClass: "tag-swap",
    route: "/dashboard/devices",
    frozenSelectorKey: 'getByRole("link", {"name":"Account"})',
    payload: { tags: { "nav.accountLink.tag": "button" } },
    interact: clickRole("/dashboard/devices", "link", "Account"),
  },
  {
    id: "tag-swap.nav.requestsLink",
    mutationClass: "tag-swap",
    route: "/dashboard/devices",
    frozenSelectorKey: 'getByRole("link", {"name":"Access Requests"})',
    payload: { tags: { "nav.requestsLink.tag": "button" } },
    interact: clickRole("/dashboard/devices", "link", "Access Requests"),
  },
  {
    id: "tag-swap.account.openDeleteButton",
    mutationClass: "tag-swap",
    route: "/dashboard/account",
    frozenSelectorKey: 'getByRole("button", {"name":"Delete Account"})',
    payload: { tags: { "account.openDeleteButton.tag": "a" } },
    interact: clickRole("/dashboard/account", "button", "Delete Account"),
  },
  {
    id: "tag-swap.account.confirmButton",
    mutationClass: "tag-swap",
    route: "/dashboard/account",
    frozenSelectorKey: 'getByRole("button", {"name":"Confirm Delete"})',
    payload: { tags: { "account.confirmButton.tag": "a" } },
    interact: async (page) => {
      await arrive(page, "/dashboard/account");
      await page.getByRole("button", { name: "Delete Account", exact: true }).click();
      await page.getByRole("button", { name: "Confirm Delete", exact: true }).click();
    },
  },
  {
    id: "tag-swap.provisioning.submitButton",
    mutationClass: "tag-swap",
    route: "/dashboard/provisioning",
    frozenSelectorKey: 'getByRole("button", {"name":"Submit Request"}) (synthetic, freshly registered)',
    payload: { tags: { "provisioning.submitButton.tag": "a" } },
    interact: clickRole("/dashboard/provisioning", "button", "Submit Request"),
  },
];

// ---- class-shuffle ----------------------------------------------------------

const classShuffleTargets: MutationTarget[] = [
  {
    id: "class-shuffle.devices.active.table",
    mutationClass: "class-shuffle",
    route: "/dashboard/devices",
    frozenSelectorKey: 'locator(".data-table tbody tr", {"hasText":"A. Ramirez"})',
    payload: { attrs: { "devices.active.table": "devices-collection" } },
    interact: clickClassScoped(
      "/dashboard/devices",
      '[data-testid="table-active-devices"].data-table',
    ),
  },
  {
    id: "class-shuffle.devices.archived.table",
    mutationClass: "class-shuffle",
    route: "/dashboard/devices",
    frozenSelectorKey: 'locator(".data-table tbody tr", {"hasText":"K. Nguyen"}) (archived)',
    payload: { attrs: { "devices.archived.table": "devices-collection-archived" } },
    interact: clickClassScoped(
      "/dashboard/devices",
      '[data-testid="table-archived-devices"].data-table',
    ),
  },
  {
    id: "class-shuffle.devices.active.card",
    mutationClass: "class-shuffle",
    route: "/dashboard/devices",
    frozenSelectorKey: 'locator(".table-card") scoped to Active',
    payload: { attrs: { "devices.active.card": "device-panel" } },
    interact: clickClassScoped("/dashboard/devices", '.table-card:has([data-testid="table-active-devices"])'),
  },
  {
    id: "class-shuffle.devices.archived.card",
    mutationClass: "class-shuffle",
    route: "/dashboard/devices",
    frozenSelectorKey: 'locator(".table-card") scoped to Archived',
    payload: { attrs: { "devices.archived.card": "device-panel-archived" } },
    interact: clickClassScoped(
      "/dashboard/devices",
      '.table-card:has([data-testid="table-archived-devices"])',
    ),
  },
  {
    id: "class-shuffle.devices.pageClassName",
    mutationClass: "class-shuffle",
    route: "/dashboard/devices",
    frozenSelectorKey: 'locator(".devices-page")',
    payload: { attrs: { "devices.pageClassName": "devices-screen" } },
    interact: clickClassScoped("/dashboard/devices", ".devices-page"),
  },
  {
    id: "class-shuffle.provisioning.pageClassName",
    mutationClass: "class-shuffle",
    route: "/dashboard/provisioning",
    frozenSelectorKey: 'locator(".provisioning-page")',
    payload: { attrs: { "provisioning.pageClassName": "provisioning-screen" } },
    interact: clickClassScoped("/dashboard/provisioning", ".provisioning-page"),
  },
  {
    id: "class-shuffle.account.pageClassName",
    mutationClass: "class-shuffle",
    route: "/dashboard/account",
    frozenSelectorKey: 'locator(".account-page")',
    payload: { attrs: { "account.pageClassName": "account-screen" } },
    interact: clickClassScoped("/dashboard/account", ".account-page"),
  },
  {
    id: "class-shuffle.nav.layoutClassName",
    mutationClass: "class-shuffle",
    route: "/dashboard/devices",
    frozenSelectorKey: 'locator(".dashboard-layout")',
    payload: { attrs: { "nav.layoutClassName": "app-shell" } },
    interact: clickClassScoped("/dashboard/devices", ".dashboard-layout"),
  },
];

// ---- sibling-reorder --------------------------------------------------------

const siblingReorderTargets: MutationTarget[] = [
  {
    id: "sibling-reorder.devices.active.rowOrder.row1",
    mutationClass: "sibling-reorder",
    route: "/dashboard/devices",
    frozenSelectorKey: 'locator(\'[data-testid="table-active-devices"] tbody tr:nth-child(1)\')',
    payload: { order: { "devices.active.rowOrder": [1, 0, 2, 3, 4] } },
    interact: assertNthRowOwner("/dashboard/devices", "table-active-devices", 1, "A. Ramirez"),
  },
  {
    id: "sibling-reorder.devices.active.rowOrder.row2",
    mutationClass: "sibling-reorder",
    route: "/dashboard/devices",
    frozenSelectorKey: 'locator(\'[data-testid="table-active-devices"] tbody tr:nth-child(2)\')',
    payload: { order: { "devices.active.rowOrder": [1, 0, 2, 3, 4] } },
    interact: assertNthRowOwner("/dashboard/devices", "table-active-devices", 2, "K. Nguyen"),
  },
  {
    id: "sibling-reorder.devices.archived.rowOrder.row1",
    mutationClass: "sibling-reorder",
    route: "/dashboard/devices",
    frozenSelectorKey: 'locator(\'[data-testid="table-archived-devices"] tbody tr:nth-child(1)\')',
    payload: { order: { "devices.archived.rowOrder": [1, 0, 2, 3, 4] } },
    interact: assertNthRowOwner("/dashboard/devices", "table-archived-devices", 1, "A. Ramirez"),
  },
  {
    id: "sibling-reorder.devices.archived.rowOrder.row2",
    mutationClass: "sibling-reorder",
    route: "/dashboard/devices",
    frozenSelectorKey: 'locator(\'[data-testid="table-archived-devices"] tbody tr:nth-child(2)\')',
    payload: { order: { "devices.archived.rowOrder": [1, 0, 2, 3, 4] } },
    interact: assertNthRowOwner("/dashboard/devices", "table-archived-devices", 2, "K. Nguyen"),
  },
  {
    id: "sibling-reorder.wizard.resourceSelect",
    mutationClass: "sibling-reorder",
    route: "/dashboard/requests/new",
    frozenSelectorKey: 'locator("#wizard-resource option:first-child")',
    payload: { order: { "wizard.resourceSelect.optionOrder": [1, 0, 2] } },
    interact: assertFirstOptionValue("/dashboard/requests/new", "wizard-resource", "Device Inventory"),
  },
  {
    id: "sibling-reorder.wizard.durationSelect",
    mutationClass: "sibling-reorder",
    route: "/dashboard/requests/new",
    frozenSelectorKey: 'locator("#wizard-duration option:first-child")',
    payload: { order: { "wizard.durationSelect.optionOrder": [1, 0, 2] } },
    interact: assertFirstOptionValue("/dashboard/requests/new", "wizard-duration", "7 days"),
  },
  {
    id: "sibling-reorder.devices.row.dev-2.actionsOrder",
    mutationClass: "sibling-reorder",
    route: "/dashboard/devices",
    frozenSelectorKey: 'locator(\'tr:has-text("K. Nguyen") td:nth-child(5) button:first-child\')',
    payload: { order: { "devices.row.dev-2.actionsOrder": [1, 0] } },
    interact: clickActionsOrderFirst("/dashboard/devices", "table-active-devices", "K. Nguyen", "Edit"),
  },
  {
    id: "sibling-reorder.devices.row.dev-4.actionsOrder",
    mutationClass: "sibling-reorder",
    route: "/dashboard/devices",
    frozenSelectorKey: 'locator(\'tr:has-text("M. Alvarez") td:nth-child(5) button:first-child\')',
    payload: { order: { "devices.row.dev-4.actionsOrder": [1, 0] } },
    interact: clickActionsOrderFirst("/dashboard/devices", "table-active-devices", "M. Alvarez", "Edit"),
  },
];

// ---- wrapper-inject ----------------------------------------------------------

const wrapperInjectTargets: MutationTarget[] = [
  {
    id: "wrapper-inject.wizard.titleInput",
    mutationClass: "wrapper-inject",
    route: "/dashboard/requests/new",
    frozenSelectorKey: "xpath parent::section probe on #wizard-title-input",
    payload: { wrap: ["wizard.titleInput"] },
    interact: fillViaExactParent("/dashboard/requests/new", "wizard-title-input", "section", "New request"),
  },
  {
    id: "wrapper-inject.wizard.requestedByInput",
    mutationClass: "wrapper-inject",
    route: "/dashboard/requests/new",
    frozenSelectorKey: "xpath parent::section probe on #wizard-requested-by-input",
    payload: { wrap: ["wizard.requestedByInput"] },
    interact: fillViaExactParent(
      "/dashboard/requests/new",
      "wizard-requested-by-input",
      "section",
      "A. Ramirez",
    ),
  },
  {
    id: "wrapper-inject.provisioning.requesterNameInput",
    mutationClass: "wrapper-inject",
    route: "/dashboard/provisioning",
    frozenSelectorKey: "xpath parent::form probe on #provisioning-requester-name-input",
    payload: { wrap: ["provisioning.requesterNameInput"] },
    interact: fillViaExactParent(
      "/dashboard/provisioning",
      "provisioning-requester-name-input",
      "form",
      "A. Ramirez",
    ),
  },
  {
    id: "wrapper-inject.provisioning.effectiveDateInput",
    mutationClass: "wrapper-inject",
    route: "/dashboard/provisioning",
    frozenSelectorKey: "xpath parent::form probe on #provisioning-effective-date-input",
    payload: { wrap: ["provisioning.effectiveDateInput"] },
    interact: fillViaExactParent(
      "/dashboard/provisioning",
      "provisioning-effective-date-input",
      "form",
      "2026-08-01",
    ),
  },
  {
    id: "wrapper-inject.provisioning.notesTextarea",
    mutationClass: "wrapper-inject",
    route: "/dashboard/provisioning",
    frozenSelectorKey: "xpath parent::form probe on #provisioning-notes-input",
    payload: { wrap: ["provisioning.notesTextarea"] },
    interact: fillViaExactParent("/dashboard/provisioning", "provisioning-notes-input", "form", "note"),
  },
  {
    id: "wrapper-inject.account.openDeleteButton",
    mutationClass: "wrapper-inject",
    route: "/dashboard/account",
    frozenSelectorKey: "xpath parent::div[@class='account-page'] probe on open-delete-account",
    payload: { wrap: ["account.openDeleteButton"] },
    interact: clickViaExactParent("/dashboard/account", "open-delete-account", "div[@class='account-page']"),
  },
  {
    id: "wrapper-inject.account.cancelButton",
    mutationClass: "wrapper-inject",
    route: "/dashboard/account",
    frozenSelectorKey: "xpath parent::div[@role='dialog'] probe on delete-account-cancel",
    payload: { wrap: ["account.cancelButton"] },
    interact: async (page) => {
      await arrive(page, "/dashboard/account");
      await page.getByTestId("open-delete-account").click();
      await page
        .locator("xpath=//*[@data-testid='delete-account-cancel']/parent::div[@role='dialog']")
        .getByTestId("delete-account-cancel")
        .click();
    },
  },
  {
    id: "wrapper-inject.account.confirmButton",
    mutationClass: "wrapper-inject",
    route: "/dashboard/account",
    frozenSelectorKey: "xpath parent::div[@role='dialog'] probe on delete-account-confirm",
    payload: { wrap: ["account.confirmButton"] },
    interact: async (page) => {
      await arrive(page, "/dashboard/account");
      await page.getByTestId("open-delete-account").click();
      await page
        .locator("xpath=//*[@data-testid='delete-account-confirm']/parent::div[@role='dialog']")
        .getByTestId("delete-account-confirm")
        .click();
    },
  },
];

// ---- near-duplicate-sibling-swap (NOTE-002) ---------------------------------
//
// Each pair contributes exactly one *live* directional target per bench run
// (the harness's ground-truth builder picks a direction per pair via the
// seeded PRNG) — never both, since mutating both directions at once would
// break the sibling that's supposed to remain a valid, tempting distractor.
// Registering both directions here (rather than only the "chosen" one)
// keeps the registry itself the source of truth for "≥8 distinct affected
// selectors this class can produce," independent of any one run's seed.

const nearDuplicatePairs: readonly (readonly [MutationTarget, MutationTarget])[] = [
  [
    {
      id: "near-dup.table-row.active",
      mutationClass: "near-duplicate-sibling-swap",
      route: "/dashboard/devices",
      frozenSelectorKey:
        'getByTestId("table-active-devices") > locator(\'tr\', {hasText:"Front Desk Tablet"}) > getByTestId("device-row-remove")',
      payload: { attrs: { "devices.active.testId": "table-active-devices-mut" } },
      interact: clickRowAction(
        "/dashboard/devices",
        "table-active-devices",
        "Front Desk Tablet",
        "device-row-remove",
      ),
      locate: locateRowAction(
        "/dashboard/devices",
        "table-active-devices",
        "Front Desk Tablet",
        "device-row-remove",
      ),
      distractorId: "near-dup.table-row.archived",
    },
    {
      id: "near-dup.table-row.archived",
      mutationClass: "near-duplicate-sibling-swap",
      route: "/dashboard/devices",
      frozenSelectorKey:
        'getByTestId("table-archived-devices") > locator(\'tr\', {hasText:"Front Desk Tablet"}) > getByTestId("device-row-remove")',
      payload: { attrs: { "devices.archived.testId": "table-archived-devices-mut" } },
      interact: clickRowAction(
        "/dashboard/devices",
        "table-archived-devices",
        "Front Desk Tablet",
        "device-row-remove",
      ),
      locate: locateRowAction(
        "/dashboard/devices",
        "table-archived-devices",
        "Front Desk Tablet",
        "device-row-remove",
      ),
      distractorId: "near-dup.table-row.active",
    },
  ],
  [
    {
      id: "near-dup.editRemove.dev-2.edit",
      mutationClass: "near-duplicate-sibling-swap",
      route: "/dashboard/devices",
      frozenSelectorKey: 'row("K. Nguyen") > getByRole("button", {"name":"Edit"})',
      payload: { text: { "devices.row.dev-2.editText": "Modify" } },
      interact: clickRowRoleButton("/dashboard/devices", "table-active-devices", "K. Nguyen", "Edit"),
      locate: locateRowRoleButton("/dashboard/devices", "table-active-devices", "K. Nguyen", "Edit"),
      distractorId: "near-dup.editRemove.dev-2.remove",
    },
    {
      id: "near-dup.editRemove.dev-2.remove",
      mutationClass: "near-duplicate-sibling-swap",
      route: "/dashboard/devices",
      frozenSelectorKey: 'row("K. Nguyen") > getByRole("button", {"name":"Remove"})',
      payload: { text: { "devices.row.dev-2.removeText": "Delete" } },
      interact: clickRowRoleButton("/dashboard/devices", "table-active-devices", "K. Nguyen", "Remove"),
      locate: locateRowRoleButton("/dashboard/devices", "table-active-devices", "K. Nguyen", "Remove"),
      distractorId: "near-dup.editRemove.dev-2.edit",
    },
  ],
  [
    {
      id: "near-dup.saveCancel.dev-3.save",
      mutationClass: "near-duplicate-sibling-swap",
      route: "/dashboard/devices",
      frozenSelectorKey: 'row("S. Patel") edit-mode > getByRole("button", {"name":"Save"})',
      payload: { text: { "devices.row.dev-3.saveText": "Apply" } },
      interact: clickEditModeButton("/dashboard/devices", "table-active-devices", "S. Patel", "Save"),
      locate: locateEditModeButton("/dashboard/devices", "table-active-devices", "S. Patel", "Save"),
      distractorId: "near-dup.saveCancel.dev-3.cancel",
    },
    {
      id: "near-dup.saveCancel.dev-3.cancel",
      mutationClass: "near-duplicate-sibling-swap",
      route: "/dashboard/devices",
      frozenSelectorKey: 'row("S. Patel") edit-mode > getByRole("button", {"name":"Cancel"})',
      payload: { text: { "devices.row.dev-3.cancelText": "Discard" } },
      interact: clickEditModeButton("/dashboard/devices", "table-active-devices", "S. Patel", "Cancel"),
      locate: locateEditModeButton("/dashboard/devices", "table-active-devices", "S. Patel", "Cancel"),
      distractorId: "near-dup.saveCancel.dev-3.save",
    },
  ],
  [
    {
      id: "near-dup.accountModal.cancel",
      mutationClass: "near-duplicate-sibling-swap",
      route: "/dashboard/account",
      frozenSelectorKey: 'getByTestId("delete-account-cancel") (rendered text "Cancel")',
      payload: { text: { "account.cancelButton.text": "Go Back" } },
      interact: async (page) => {
        await arrive(page, "/dashboard/account");
        await page.getByTestId("open-delete-account").click();
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
      },
      locate: async (page) => {
        await arrive(page, "/dashboard/account");
        await page.getByTestId("open-delete-account").click();
        return page.getByRole("button", { name: "Cancel", exact: true });
      },
      distractorId: "near-dup.accountModal.confirm",
    },
    {
      id: "near-dup.accountModal.confirm",
      mutationClass: "near-duplicate-sibling-swap",
      route: "/dashboard/account",
      frozenSelectorKey: 'getByRole("button", {"name":"Confirm Delete"})',
      payload: { text: { "account.confirmButton.text": "Yes, Delete" } },
      interact: async (page) => {
        await arrive(page, "/dashboard/account");
        await page.getByTestId("open-delete-account").click();
        await page.getByRole("button", { name: "Confirm Delete", exact: true }).click();
      },
      locate: async (page) => {
        await arrive(page, "/dashboard/account");
        await page.getByTestId("open-delete-account").click();
        return page.getByRole("button", { name: "Confirm Delete", exact: true });
      },
      distractorId: "near-dup.accountModal.cancel",
    },
  ],
  [
    {
      id: "near-dup.editRemove.dev-4.edit",
      mutationClass: "near-duplicate-sibling-swap",
      route: "/dashboard/devices",
      frozenSelectorKey: 'row("M. Alvarez") > getByRole("button", {"name":"Edit"})',
      payload: { text: { "devices.row.dev-4.editText": "Modify" } },
      interact: clickRowRoleButton("/dashboard/devices", "table-active-devices", "M. Alvarez", "Edit"),
      locate: locateRowRoleButton("/dashboard/devices", "table-active-devices", "M. Alvarez", "Edit"),
      distractorId: "near-dup.editRemove.dev-4.remove",
    },
    {
      id: "near-dup.editRemove.dev-4.remove",
      mutationClass: "near-duplicate-sibling-swap",
      route: "/dashboard/devices",
      frozenSelectorKey: 'row("M. Alvarez") > getByRole("button", {"name":"Remove"})',
      payload: { text: { "devices.row.dev-4.removeText": "Delete" } },
      interact: clickRowRoleButton("/dashboard/devices", "table-active-devices", "M. Alvarez", "Remove"),
      locate: locateRowRoleButton("/dashboard/devices", "table-active-devices", "M. Alvarez", "Remove"),
      distractorId: "near-dup.editRemove.dev-4.edit",
    },
  ],
  [
    {
      id: "near-dup.saveCancel.dev-5.save",
      mutationClass: "near-duplicate-sibling-swap",
      route: "/dashboard/devices",
      frozenSelectorKey: 'row("T. Chen") edit-mode > getByRole("button", {"name":"Save"})',
      payload: { text: { "devices.row.dev-5.saveText": "Apply" } },
      interact: clickEditModeButton("/dashboard/devices", "table-active-devices", "T. Chen", "Save"),
      locate: locateEditModeButton("/dashboard/devices", "table-active-devices", "T. Chen", "Save"),
      distractorId: "near-dup.saveCancel.dev-5.cancel",
    },
    {
      id: "near-dup.saveCancel.dev-5.cancel",
      mutationClass: "near-duplicate-sibling-swap",
      route: "/dashboard/devices",
      frozenSelectorKey: 'row("T. Chen") edit-mode > getByRole("button", {"name":"Cancel"})',
      payload: { text: { "devices.row.dev-5.cancelText": "Discard" } },
      interact: clickEditModeButton("/dashboard/devices", "table-active-devices", "T. Chen", "Cancel"),
      locate: locateEditModeButton("/dashboard/devices", "table-active-devices", "T. Chen", "Cancel"),
      distractorId: "near-dup.saveCancel.dev-5.save",
    },
  ],
  [
    {
      id: "near-dup.wizardFields.title",
      mutationClass: "near-duplicate-sibling-swap",
      route: "/dashboard/requests/new",
      frozenSelectorKey: 'getByLabel("Request Title")',
      payload: { text: { "wizard.titleInput.label": "Title" } },
      interact: fillLabel("/dashboard/requests/new", "Request Title", "New request"),
      locate: locateLabelField("/dashboard/requests/new", "Request Title"),
      distractorId: "near-dup.wizardFields.requestedBy",
    },
    {
      id: "near-dup.wizardFields.requestedBy",
      mutationClass: "near-duplicate-sibling-swap",
      route: "/dashboard/requests/new",
      frozenSelectorKey: 'getByLabel("Requested By")',
      payload: { text: { "wizard.requestedByInput.label": "Submitter" } },
      interact: fillLabel("/dashboard/requests/new", "Requested By", "A. Ramirez"),
      locate: locateLabelField("/dashboard/requests/new", "Requested By"),
      distractorId: "near-dup.wizardFields.title",
    },
  ],
  [
    {
      id: "near-dup.editRemove.dev-9.edit",
      mutationClass: "near-duplicate-sibling-swap",
      route: "/dashboard/devices",
      frozenSelectorKey: 'row("Front Desk Tablet", archived) > getByRole("button", {"name":"Edit"})',
      payload: { text: { "devices.row.dev-9.editText": "Modify" } },
      interact: clickRowRoleButton(
        "/dashboard/devices",
        "table-archived-devices",
        "Front Desk Tablet",
        "Edit",
      ),
      locate: locateRowRoleButton(
        "/dashboard/devices",
        "table-archived-devices",
        "Front Desk Tablet",
        "Edit",
      ),
      distractorId: "near-dup.editRemove.dev-9.remove",
    },
    {
      id: "near-dup.editRemove.dev-9.remove",
      mutationClass: "near-duplicate-sibling-swap",
      route: "/dashboard/devices",
      frozenSelectorKey: 'row("Front Desk Tablet", archived) > getByRole("button", {"name":"Remove"})',
      payload: { text: { "devices.row.dev-9.removeText": "Delete" } },
      interact: clickRowRoleButton(
        "/dashboard/devices",
        "table-archived-devices",
        "Front Desk Tablet",
        "Remove",
      ),
      locate: locateRowRoleButton(
        "/dashboard/devices",
        "table-archived-devices",
        "Front Desk Tablet",
        "Remove",
      ),
      distractorId: "near-dup.editRemove.dev-9.edit",
    },
  ],
];

const nearDuplicateTargets: MutationTarget[] = nearDuplicatePairs.flatMap(([a, b]) => [a, b]);

// ---- registry ---------------------------------------------------------------

export const BASE_MUTATION_TARGETS: readonly MutationTarget[] = [
  ...idRenameTargets,
  ...textChangeTargets,
  ...tagSwapTargets,
  ...classShuffleTargets,
  ...siblingReorderTargets,
  ...wrapperInjectTargets,
];

export const ALL_MUTATION_TARGETS: readonly MutationTarget[] = [
  ...BASE_MUTATION_TARGETS,
  ...nearDuplicateTargets,
];

export function targetsForClass(mutationClass: MutationClass): readonly MutationTarget[] {
  if (mutationClass === "compound-release") {
    return BASE_MUTATION_TARGETS;
  }
  return ALL_MUTATION_TARGETS.filter((target) => target.mutationClass === mutationClass);
}

export function targetById(id: string): MutationTarget {
  const target = ALL_MUTATION_TARGETS.find((candidate) => candidate.id === id);
  if (target === undefined) {
    throw new Error(`Unknown mutation target id: ${id}`);
  }
  return target;
}

export { nearDuplicatePairs };
