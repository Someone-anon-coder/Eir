import type { HealerClass, SpecDraft } from "./specDraft.js";

/**
 * Drafts for the five base classes added after the pilot: text-change,
 * tag-swap, class-shuffle, sibling-reorder, wrapper-inject. Same rules as
 * specDrafts.ts: act through the frozen locator, verify through an
 * independent unmutated route, never use another mutated element for setup.
 */

const DEVICES = "/dashboard/devices";
const ACCOUNT = "/dashboard/account";
const PROVISIONING = "/dashboard/provisioning";
const WIZARD = "/dashboard/requests/new";

const draft = (
  targetId: string,
  mutationClass: HealerClass,
  element: string,
  route: string,
  body: readonly string[],
  actedBy?: "path",
): SpecDraft => ({
  targetId,
  mutationClass,
  element,
  route,
  auth: "session",
  body,
  expectation: "heal",
  ...(actedBy !== undefined ? { actedBy } : {}),
});

const URLS = {
  provisioning: "/\\/dashboard\\/provisioning/",
  account: "/\\/dashboard\\/account/",
  requests: "/\\/dashboard\\/requests\\/new/",
  devices: "/\\/dashboard\\/devices/",
  login: "/\\/login/",
} as const;

/** Click a nav control (found by role and accessible name), then land on `url`. */
function navClick(
  cls: HealerClass,
  area: string,
  element: string,
  route: string,
  role: "link" | "button",
  name: string,
  url: keyof typeof URLS,
): SpecDraft {
  return draft(`${cls}.${area}`, cls, element, route, [
    `await page.getByRole('${role}', { name: '${name}', exact: true }).click();`,
    `await expect(page).toHaveURL(${URLS[url]});`,
  ]);
}

const DIALOG_OPEN = "await expect(page.getByTestId('delete-account-dialog')).toBeVisible();";
const DELETED = "await expect(page.getByTestId('account-deleted-banner')).toBeVisible();";
const OPEN_DELETE_BY_TESTID = "await page.getByTestId('open-delete-account').click();";

const TEXT_CHANGE: readonly SpecDraft[] = [
  navClick(
    "text-change",
    "nav.provisioningLink",
    "nav.provisioningLink",
    DEVICES,
    "link",
    "Provisioning",
    "provisioning",
  ),
  navClick(
    "text-change",
    "nav.logoutButton",
    "nav.logoutButton",
    DEVICES,
    "button",
    "Log Out",
    "login",
  ),
  navClick(
    "text-change",
    "nav.accountLink",
    "nav.accountLink",
    DEVICES,
    "link",
    "Account",
    "account",
  ),
  navClick(
    "text-change",
    "nav.requestsLink",
    "nav.requestsLink",
    DEVICES,
    "link",
    "Access Requests",
    "requests",
  ),
  draft(
    "text-change.account.openDeleteButton",
    "text-change",
    "account.openDeleteButton",
    ACCOUNT,
    [
      "await page.getByRole('button', { name: 'Delete Account', exact: true }).click();",
      DIALOG_OPEN,
    ],
  ),
  draft("text-change.account.confirmButton", "text-change", "account.confirmButton", ACCOUNT, [
    OPEN_DELETE_BY_TESTID,
    "await page.getByRole('button', { name: 'Confirm Delete', exact: true }).click();",
    DELETED,
  ]),
  draft("text-change.devices.archivedRowName", "text-change", "devices.row.dev-10.edit", DEVICES, [
    "const row = page.getByTestId('table-archived-devices').locator('tr', { hasText: 'Legacy Barcode Scanner' });",
    "await row.getByRole('button', { name: 'Edit', exact: true }).click();",
    // The name cell becomes an input in edit mode, so verify through the owner column.
    "await expect(page.getByTestId('table-archived-devices').locator('tr', { hasText: 'K. Nguyen' }).getByRole('textbox')).toBeVisible();",
  ]),
  draft("text-change.wizard.nextButtonStep1", "text-change", "wizard.nextButton.step1", WIZARD, [
    "await page.getByRole('button', { name: 'Next', exact: true }).click();",
    "await expect(page.getByTestId('wizard-step-heading')).toContainText('Step 2');",
  ]),
];

const TAG_SWAP: readonly SpecDraft[] = [
  navClick(
    "tag-swap",
    "nav.logoutButton",
    "nav.logoutButton",
    DEVICES,
    "button",
    "Log Out",
    "login",
  ),
  // Starts on Account: clicking Devices from the Devices page would assert nothing.
  navClick("tag-swap", "nav.devicesLink", "nav.devicesLink", ACCOUNT, "link", "Devices", "devices"),
  navClick(
    "tag-swap",
    "nav.provisioningLink",
    "nav.provisioningLink",
    DEVICES,
    "link",
    "Provisioning",
    "provisioning",
  ),
  navClick("tag-swap", "nav.accountLink", "nav.accountLink", DEVICES, "link", "Account", "account"),
  navClick(
    "tag-swap",
    "nav.requestsLink",
    "nav.requestsLink",
    DEVICES,
    "link",
    "Access Requests",
    "requests",
  ),
  draft("tag-swap.account.openDeleteButton", "tag-swap", "account.openDeleteButton", ACCOUNT, [
    "await page.getByRole('button', { name: 'Delete Account', exact: true }).click();",
    DIALOG_OPEN,
  ]),
  draft("tag-swap.account.confirmButton", "tag-swap", "account.confirmButton", ACCOUNT, [
    OPEN_DELETE_BY_TESTID,
    "await page.getByRole('button', { name: 'Confirm Delete', exact: true }).click();",
    DELETED,
  ]),
  draft(
    "tag-swap.provisioning.submitButton",
    "tag-swap",
    "provisioning.submitButton",
    PROVISIONING,
    [
      "await page.getByRole('button', { name: 'Submit Request', exact: true }).click();",
      "await expect(page.getByTestId('provisioning-success')).toBeVisible();",
    ],
  ),
];

/**
 * The original probes click a container, which does nothing observable, so
 * these post-conditions only check the page is intact. Attribution is by
 * marked-ancestor path (see `SpecDraft.actedBy`): weaker evidence than the
 * other classes, stated in docs/healer-comparison.md.
 */
function containerClick(
  id: string,
  element: string,
  route: string,
  css: string,
  heading: string,
): SpecDraft {
  return draft(
    `class-shuffle.${id}`,
    "class-shuffle",
    element,
    route,
    [
      `await page.locator('${css}').click();`,
      `await expect(page.getByRole('heading', { name: '${heading}', exact: true })).toBeVisible();`,
    ],
    "path",
  );
}

const CLASS_SHUFFLE: readonly SpecDraft[] = [
  containerClick(
    "devices.active.table",
    "devices.active.table",
    DEVICES,
    '[data-testid="table-active-devices"].data-table',
    "Active Devices",
  ),
  containerClick(
    "devices.archived.table",
    "devices.archived.table",
    DEVICES,
    '[data-testid="table-archived-devices"].data-table',
    "Archived Devices",
  ),
  containerClick(
    "devices.active.card",
    "devices.active.card",
    DEVICES,
    '.table-card:has([data-testid="table-active-devices"])',
    "Active Devices",
  ),
  containerClick(
    "devices.archived.card",
    "devices.archived.card",
    DEVICES,
    '.table-card:has([data-testid="table-archived-devices"])',
    "Archived Devices",
  ),
  containerClick(
    "devices.pageClassName",
    "devices.pageClassName",
    DEVICES,
    ".devices-page",
    "Active Devices",
  ),
  containerClick(
    "provisioning.pageClassName",
    "provisioning.pageClassName",
    PROVISIONING,
    ".provisioning-page",
    "New Device Provisioning Request",
  ),
  containerClick(
    "account.pageClassName",
    "account.pageClassName",
    ACCOUNT,
    ".account-page",
    "Account",
  ),
  draft(
    "class-shuffle.nav.layoutClassName",
    "class-shuffle",
    "nav.layoutClassName",
    DEVICES,
    [
      "await page.locator('.dashboard-layout').click();",
      "await expect(page.getByTestId('dashboard-nav')).toBeVisible();",
    ],
    "path",
  ),
];

/**
 * sibling-reorder: the frozen selector is positional. The action is "edit
 * the Nth row" and the post-condition names the owner, so a reordered table
 * edits the wrong row and the spec goes red; a fix has to find the row by
 * what it is, not where it is.
 */
function editNthRow(
  id: string,
  table: string,
  n: number,
  owner: string,
  element: string,
): SpecDraft {
  return draft(`sibling-reorder.${id}`, "sibling-reorder", element, DEVICES, [
    `await page.locator('[data-testid="${table}"] tbody tr:nth-child(${n})').getByTestId('device-row-edit').click();`,
    `await expect(page.getByTestId('${table}').locator('tr', { hasText: '${owner}' }).getByRole('textbox')).toBeVisible();`,
  ]);
}

function firstActionEdit(id: string, owner: string, element: string): SpecDraft {
  return draft(
    `sibling-reorder.devices.row.${id}.actionsOrder`,
    "sibling-reorder",
    element,
    DEVICES,
    [
      `await page.getByTestId('table-active-devices').locator('tr', { hasText: '${owner}' }).locator('td:nth-child(5) button:first-child').click();`,
      `await expect(page.getByTestId('table-active-devices').locator('tr', { hasText: '${owner}' }).getByRole('textbox')).toBeVisible();`,
    ],
  );
}

/** A select is judged on its chosen value: the marker can only say the select changed. */
function pickFirstOption(id: string, selectId: string, value: string, element: string): SpecDraft {
  return draft(`sibling-reorder.wizard.${id}`, "sibling-reorder", element, WIZARD, [
    "await page.getByTestId('wizard-next').click();",
    `await page.locator('#${selectId}').selectOption({ index: 0 });`,
    `await expect(page.getByLabel('${id === "resourceSelect" ? "Resource" : "Duration"}')).toHaveValue('${value}');`,
  ]);
}

const SIBLING_REORDER: readonly SpecDraft[] = [
  editNthRow(
    "devices.active.rowOrder.row1",
    "table-active-devices",
    1,
    "A. Ramirez",
    "devices.row.dev-1.edit",
  ),
  editNthRow(
    "devices.active.rowOrder.row2",
    "table-active-devices",
    2,
    "K. Nguyen",
    "devices.row.dev-2.edit",
  ),
  editNthRow(
    "devices.archived.rowOrder.row1",
    "table-archived-devices",
    1,
    "A. Ramirez",
    "devices.row.dev-9.edit",
  ),
  editNthRow(
    "devices.archived.rowOrder.row2",
    "table-archived-devices",
    2,
    "K. Nguyen",
    "devices.row.dev-10.edit",
  ),
  pickFirstOption("resourceSelect", "wizard-resource", "Device Inventory", "wizard.resourceSelect"),
  pickFirstOption("durationSelect", "wizard-duration", "7 days", "wizard.durationSelect"),
  firstActionEdit("dev-2", "K. Nguyen", "devices.row.dev-2.edit"),
  firstActionEdit("dev-4", "M. Alvarez", "devices.row.dev-4.edit"),
];

/** wrapper-inject: the frozen selector pins the element's exact parent, which an injected wrapper changes. */
function viaParent(
  id: string,
  element: string,
  route: string,
  cssId: string,
  parent: string,
  value: string,
  verify: string,
): SpecDraft {
  return draft(`wrapper-inject.${id}`, "wrapper-inject", element, route, [
    `await page.locator("xpath=//*[@id='${cssId}']/parent::${parent}").locator('#${cssId}').fill('${value}');`,
    `await expect(page.${verify}).toHaveValue('${value}');`,
  ]);
}

function viaParentClick(
  id: string,
  element: string,
  testId: string,
  parent: string,
  before: readonly string[],
  after: string,
): SpecDraft {
  return draft(`wrapper-inject.account.${id}`, "wrapper-inject", element, ACCOUNT, [
    ...before,
    `await page.locator("xpath=//*[@data-testid='${testId}']/parent::${parent}").getByTestId('${testId}').click();`,
    after,
  ]);
}

const WRAPPER_INJECT: readonly SpecDraft[] = [
  viaParent(
    "wizard.titleInput",
    "wizard.titleInput",
    WIZARD,
    "wizard-title-input",
    "section",
    "New request",
    "getByTestId('wizard-title')",
  ),
  viaParent(
    "wizard.requestedByInput",
    "wizard.requestedByInput",
    WIZARD,
    "wizard-requested-by-input",
    "section",
    "A. Ramirez",
    "getByTestId('wizard-requested-by')",
  ),
  viaParent(
    "provisioning.requesterNameInput",
    "provisioning.requesterNameInput",
    PROVISIONING,
    "provisioning-requester-name-input",
    "form",
    "A. Ramirez",
    "getByTestId('provisioning-requester-name')",
  ),
  viaParent(
    "provisioning.effectiveDateInput",
    "provisioning.effectiveDateInput",
    PROVISIONING,
    "provisioning-effective-date-input",
    "form",
    "2026-12-01",
    "getByTestId('provisioning-effective-date')",
  ),
  viaParent(
    "provisioning.notesTextarea",
    "provisioning.notesTextarea",
    PROVISIONING,
    "provisioning-notes-input",
    "form",
    "Needs a tablet",
    "getByTestId('provisioning-notes')",
  ),
  viaParentClick(
    "openDeleteButton",
    "account.openDeleteButton",
    "open-delete-account",
    "div[@class='account-page']",
    [],
    DIALOG_OPEN,
  ),
  viaParentClick(
    "cancelButton",
    "account.cancelButton",
    "delete-account-cancel",
    "div[@role='dialog']",
    [OPEN_DELETE_BY_TESTID],
    "await expect(page.getByTestId('delete-account-dialog')).toBeHidden();",
  ),
  viaParentClick(
    "confirmButton",
    "account.confirmButton",
    "delete-account-confirm",
    "div[@role='dialog']",
    [OPEN_DELETE_BY_TESTID],
    DELETED,
  ),
];

export const BASE_DRAFTS: readonly SpecDraft[] = [
  ...TEXT_CHANGE,
  ...TAG_SWAP,
  ...CLASS_SHUFFLE,
  ...SIBLING_REORDER,
  ...WRAPPER_INJECT,
];
