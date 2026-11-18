import type { SpecDraft } from "./specDraft.js";

/**
 * Per-target spec drafts. Every body ends in at least one post-condition
 * that passes on unmutated Ward and checks the action did its job; the
 * control run proves that for every draft (see `controlProof`).
 *
 * Specs written here never use another mutated element for setup: a class
 * run mutates all of its targets in one build, so a spec that clicked a
 * sibling target's (renamed) button would fail for the wrong reason.
 */

const DEVICES = "/dashboard/devices";
const ACTIVE = "table-active-devices";
const ARCHIVED = "table-archived-devices";

interface RowRef {
  readonly id: string;
  readonly table: string;
  readonly owner: string;
}

const ROWS = {
  "dev-1": { id: "dev-1", table: ACTIVE, owner: "Front Desk Tablet" },
  "dev-2": { id: "dev-2", table: ACTIVE, owner: "K. Nguyen" },
  "dev-3": { id: "dev-3", table: ACTIVE, owner: "S. Patel" },
  "dev-4": { id: "dev-4", table: ACTIVE, owner: "M. Alvarez" },
  "dev-5": { id: "dev-5", table: ACTIVE, owner: "T. Chen" },
  "dev-9": { id: "dev-9", table: ARCHIVED, owner: "Front Desk Tablet" },
} as const satisfies Record<string, RowRef>;

type RowId = keyof typeof ROWS;

const rowLine = (r: RowRef): string =>
  `const row = page.getByTestId('${r.table}').locator('tr', { hasText: '${r.owner}' });`;
const rowGone = (r: RowRef): string =>
  `await expect(page.getByTestId('${r.table}').locator('tr', { hasText: '${r.owner}' })).toHaveCount(0);`;

type RowAction = "edit" | "remove" | "save" | "cancel";

function rowActionBody(r: RowRef, action: RowAction): readonly string[] {
  const button = (name: string): string =>
    `await row.getByRole('button', { name: '${name}', exact: true }).click();`;
  switch (action) {
    case "edit":
      return [rowLine(r), button("Edit"), "await expect(row.getByRole('textbox')).toBeVisible();"];
    case "remove":
      return [rowLine(r), button("Remove"), rowGone(r)];
    case "save":
      return [
        rowLine(r),
        "await row.getByTestId('device-row-edit').click();",
        "await row.getByRole('textbox').fill('Renamed Device');",
        button("Save"),
        `await expect(page.getByTestId('${r.table}').getByText('Renamed Device')).toBeVisible();`,
      ];
    case "cancel":
      return [
        rowLine(r),
        "await row.getByTestId('device-row-edit').click();",
        "await row.getByRole('textbox').fill('Renamed Device');",
        button("Cancel"),
        `await expect(page.getByTestId('${r.table}').getByText('Renamed Device')).toHaveCount(0);`,
      ];
  }
}

const OPPOSITE: Record<RowAction, RowAction> = {
  edit: "remove",
  remove: "edit",
  save: "cancel",
  cancel: "save",
};

function nearDupRow(targetId: string, row: RowId, action: RowAction): SpecDraft {
  const r = ROWS[row];
  return {
    targetId,
    mutationClass: "near-duplicate-sibling-swap",
    element: `devices.row.${r.id}.${action}`,
    decoyElement: `devices.row.${r.id}.${OPPOSITE[action]}`,
    route: DEVICES,
    auth: "session",
    body: rowActionBody(r, action),
    expectation: "heal",
  };
}

/**
 * Acts through the frozen (soon-mutated) locator and verifies through a
 * different, unmutated route to the same element. A post-condition that
 * re-resolved the mutated locator would fail for both tools after a correct
 * fix, and would test the assertion's locator rather than the action.
 */
function fillField(
  targetId: string,
  mutationClass: SpecDraft["mutationClass"],
  element: string,
  route: string,
  actLocator: string,
  verifyLocator: string,
  value: string,
  decoyElement?: string,
): SpecDraft {
  return {
    targetId,
    mutationClass,
    element,
    ...(decoyElement !== undefined ? { decoyElement } : {}),
    route,
    auth: "session",
    body: [
      `await page.${actLocator}.fill('${value}');`,
      `await expect(page.${verifyLocator}).toHaveValue('${value}');`,
    ],
    expectation: "heal",
  };
}

const LOGIN_PASSWORD = `await page.locator('.login-page form input[type="password"]').fill('correct-horse');`;
const LOGIN_USERNAME = `await page.locator('.login-page form input:not([type="password"])').fill('aayush');`;
const LOGIN_SUBMIT = `await page.locator('.login-page form button[type="submit"]').click();`;
const LOGIN_SUCCESS = "await expect(page).toHaveURL(/\\/dashboard\\/devices/);";

function loginUsername(targetId: string, locator: string): SpecDraft {
  return {
    targetId,
    mutationClass: "id-rename",
    element: "login.usernameInput",
    route: "/login",
    auth: "none",
    body: [`await page.${locator}.fill('aayush');`, LOGIN_PASSWORD, LOGIN_SUBMIT, LOGIN_SUCCESS],
    expectation: "heal",
  };
}

const ID_RENAME: readonly SpecDraft[] = [
  loginUsername("id-rename.login.usernameInputId", "locator('#login-username-input')"),
  {
    targetId: "id-rename.login.passwordInputId",
    mutationClass: "id-rename",
    element: "login.passwordInput",
    route: "/login",
    auth: "none",
    body: [
      LOGIN_USERNAME,
      "await page.locator('#login-password-input').fill('correct-horse');",
      LOGIN_SUBMIT,
      LOGIN_SUCCESS,
    ],
    expectation: "heal",
  },
  loginUsername("id-rename.login.usernameInput", "getByTestId('login-username')"),
  fillField(
    "id-rename.provisioning.requesterNameInput",
    "id-rename",
    "provisioning.requesterNameInput",
    "/dashboard/provisioning",
    "getByTestId('provisioning-requester-name')",
    "getByLabel('Requester Name')",
    "A. Ramirez",
  ),
  {
    targetId: "id-rename.provisioning.submitButton",
    mutationClass: "id-rename",
    element: "provisioning.submitButton",
    route: "/dashboard/provisioning",
    auth: "session",
    body: [
      "await page.getByTestId('provisioning-submit').click();",
      "await expect(page.getByTestId('provisioning-success')).toBeVisible();",
    ],
    expectation: "heal",
  },
  fillField(
    "id-rename.wizard.titleInput",
    "id-rename",
    "wizard.titleInput",
    "/dashboard/requests/new",
    "getByTestId('wizard-title')",
    "getByLabel('Request Title')",
    "Laptop request",
  ),
  fillField(
    "id-rename.wizard.requestedByInput",
    "id-rename",
    "wizard.requestedByInput",
    "/dashboard/requests/new",
    "getByTestId('wizard-requested-by')",
    "getByLabel('Requested By')",
    "A. Ramirez",
  ),
  {
    targetId: "id-rename.account.openDeleteButton",
    mutationClass: "id-rename",
    element: "account.openDeleteButton",
    route: "/dashboard/account",
    auth: "session",
    body: [
      "await page.getByTestId('open-delete-account').click();",
      "await expect(page.getByTestId('delete-account-dialog')).toBeVisible();",
    ],
    expectation: "heal",
  },
];

function tableRow(targetId: string, row: "dev-1" | "dev-9", twin: "dev-1" | "dev-9"): SpecDraft {
  const r = ROWS[row];
  return {
    targetId,
    mutationClass: "near-duplicate-sibling-swap",
    element: `devices.row.${r.id}.remove`,
    decoyElement: `devices.row.${twin}.remove`,
    route: DEVICES,
    auth: "session",
    body: [
      rowLine(r),
      "await row.getByTestId('device-row-remove').click();",
      // Through the card heading, not the table testid this target mutates.
      `await expect(page.locator('section', { has: page.getByRole('heading', { name: '${r.table === ACTIVE ? "Active" : "Archived"} Devices' }) }).getByRole('row', { name: /${r.owner}/ })).toHaveCount(0);`,
    ],
    expectation: "heal",
  };
}

function accountModal(targetId: string, button: "Cancel" | "Confirm Delete"): SpecDraft {
  const isCancel = button === "Cancel";
  return {
    targetId,
    mutationClass: "near-duplicate-sibling-swap",
    element: isCancel ? "account.cancelButton" : "account.confirmButton",
    decoyElement: isCancel ? "account.confirmButton" : "account.cancelButton",
    route: "/dashboard/account",
    auth: "session",
    body: [
      "await page.getByTestId('open-delete-account').click();",
      `await page.getByRole('button', { name: '${button}', exact: true }).click();`,
      isCancel
        ? "await expect(page.getByTestId('delete-account-dialog')).toBeHidden();"
        : "await expect(page.getByTestId('account-deleted-banner')).toBeVisible();",
    ],
    expectation: "heal",
  };
}

const NEAR_DUP: readonly SpecDraft[] = [
  tableRow("near-dup.table-row.active", "dev-1", "dev-9"),
  tableRow("near-dup.table-row.archived", "dev-9", "dev-1"),
  nearDupRow("near-dup.editRemove.dev-2.edit", "dev-2", "edit"),
  nearDupRow("near-dup.editRemove.dev-2.remove", "dev-2", "remove"),
  nearDupRow("near-dup.saveCancel.dev-3.save", "dev-3", "save"),
  nearDupRow("near-dup.saveCancel.dev-3.cancel", "dev-3", "cancel"),
  accountModal("near-dup.accountModal.cancel", "Cancel"),
  accountModal("near-dup.accountModal.confirm", "Confirm Delete"),
  nearDupRow("near-dup.editRemove.dev-4.edit", "dev-4", "edit"),
  nearDupRow("near-dup.editRemove.dev-4.remove", "dev-4", "remove"),
  nearDupRow("near-dup.saveCancel.dev-5.save", "dev-5", "save"),
  nearDupRow("near-dup.saveCancel.dev-5.cancel", "dev-5", "cancel"),
  fillField(
    "near-dup.wizardFields.title",
    "near-duplicate-sibling-swap",
    "wizard.titleInput",
    "/dashboard/requests/new",
    "getByLabel('Request Title')",
    "getByTestId('wizard-title')",
    "New request",
    "wizard.requestedByInput",
  ),
  fillField(
    "near-dup.wizardFields.requestedBy",
    "near-duplicate-sibling-swap",
    "wizard.requestedByInput",
    "/dashboard/requests/new",
    "getByLabel('Requested By')",
    "getByTestId('wizard-requested-by')",
    "A. Ramirez",
    "wizard.titleInput",
  ),
  nearDupRow("near-dup.editRemove.dev-9.edit", "dev-9", "edit"),
  nearDupRow("near-dup.editRemove.dev-9.remove", "dev-9", "remove"),
];

const WIZARD = "/dashboard/requests/new";
const WIZARD_TO_REVIEW = [
  "await page.getByTestId('wizard-title').fill('Laptop request');",
  "await page.getByTestId('wizard-requested-by').fill('A. Ramirez');",
  "await page.getByTestId('wizard-next').click();",
  "await page.getByTestId('wizard-next').click();",
];

function newKind(
  targetId: string,
  mutationClass: "real-regression" | "flow-change",
  element: string,
  route: string,
  body: readonly string[],
  auth: SpecDraft["auth"] = "session",
): SpecDraft {
  return {
    targetId,
    mutationClass,
    element,
    route,
    auth,
    body,
    expectation: mutationClass === "real-regression" ? "stay-red" : "heal",
  };
}

const REAL_REGRESSION: readonly SpecDraft[] = [
  newKind(
    "real-regression.devices.saveIgnoresEdit",
    "real-regression",
    "devices.row.dev-4.save",
    DEVICES,
    rowActionBody(ROWS["dev-4"], "save"),
  ),
  newKind(
    "real-regression.provisioning.successBecomesError",
    "real-regression",
    "provisioning.submitButton",
    "/dashboard/provisioning",
    [
      "await page.getByTestId('provisioning-submit').click();",
      "await expect(page.getByTestId('provisioning-success')).toContainText('submitted');",
    ],
  ),
  newKind(
    "real-regression.account.confirmDoesNothing",
    "real-regression",
    "account.confirmButton",
    "/dashboard/account",
    [
      "await page.getByTestId('open-delete-account').click();",
      "await page.getByTestId('delete-account-confirm').click();",
      "await expect(page.getByTestId('account-deleted-banner')).toBeVisible();",
    ],
  ),
  newKind(
    "real-regression.wizard.reviewShowsWrongValue",
    "real-regression",
    "wizard.requestedByInput",
    WIZARD,
    [
      ...WIZARD_TO_REVIEW,
      "await expect(page.getByTestId('wizard-review-summary')).toContainText('Requested By: A. Ramirez');",
    ],
  ),
  newKind(
    "real-regression.wizard.submitDoesNothing",
    "real-regression",
    "wizard.submitButton",
    WIZARD,
    [
      ...WIZARD_TO_REVIEW,
      "await page.getByTestId('wizard-submit').click();",
      "await expect(page.getByTestId('wizard-success')).toBeVisible();",
    ],
  ),
  newKind(
    "real-regression.devices.removeKeepsRow",
    "real-regression",
    "devices.row.dev-4.remove",
    DEVICES,
    rowActionBody(ROWS["dev-4"], "remove"),
  ),
  newKind(
    "real-regression.login.acceptsEmptyPassword",
    "real-regression",
    "login.passwordInput",
    "/login",
    [
      LOGIN_USERNAME,
      LOGIN_SUBMIT,
      "await expect(page.getByTestId('login-error')).toBeVisible();",
      "await expect(page).toHaveURL(/\\/login/);",
    ],
    "none",
  ),
];

const FLOW_CHANGE: readonly SpecDraft[] = [
  newKind(
    "flow-change.account.deleteInOverflow",
    "flow-change",
    "account.openDeleteButton",
    "/dashboard/account",
    [
      "await page.getByTestId('open-delete-account').click();",
      "await expect(page.getByTestId('delete-account-dialog')).toBeVisible();",
    ],
  ),
  newKind(
    "flow-change.provisioning.confirmStep",
    "flow-change",
    "provisioning.submitButton",
    "/dashboard/provisioning",
    [
      "await page.getByTestId('provisioning-submit').click();",
      "await expect(page.getByTestId('provisioning-success')).toBeVisible();",
    ],
  ),
  newKind("flow-change.wizard.termsStep", "flow-change", "wizard.submitButton", WIZARD, [
    ...WIZARD_TO_REVIEW,
    "await page.getByTestId('wizard-submit').click();",
    "await expect(page.getByTestId('wizard-success')).toBeVisible();",
  ]),
  newKind(
    "flow-change.devices.removeConfirm",
    "flow-change",
    "devices.row.dev-4.remove",
    DEVICES,
    rowActionBody(ROWS["dev-4"], "remove"),
  ),
  newKind("flow-change.nav.logoutInMenu", "flow-change", "nav.logoutButton", "/dashboard/devices", [
    "await page.getByTestId('nav-logout').click();",
    "await expect(page).toHaveURL(/\\/login/);",
  ]),
];

/** Authored so far: the pilot classes plus both new kinds. The other five base classes follow the pilot. */
export const SPEC_DRAFTS: readonly SpecDraft[] = [
  ...ID_RENAME,
  ...NEAR_DUP,
  ...REAL_REGRESSION,
  ...FLOW_CHANGE,
];

export function draftFor(targetId: string): SpecDraft | undefined {
  return SPEC_DRAFTS.find((d) => d.targetId === targetId);
}
