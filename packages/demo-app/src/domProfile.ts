import { overrideAttr } from "./mutation/overrides.js";

/**
 * Single source of truth for every id / data-testid / structural class
 * Ward's components render. Every value routes through `overrideAttr`
 * keyed by its own dotted path — a plain pass-through of the literal
 * fallback unless the benchmark harness (packages/benchmark) has set
 * `VITE_EIR_MUTATIONS` for an `id-rename` (or `near-duplicate-sibling-swap`)
 * run. The harness's probe specs use frozen selector literals, never a
 * live `domProfile` import, so mutating a value here changes what the app
 * renders without changing what an already-written test expects — see
 * `mutation/overrides.ts`'s docstring for why that split matters.
 */
export const domProfile = {
  login: {
    form: overrideAttr("login.form", "login-form"),
    usernameInput: overrideAttr("login.usernameInput", "login-username"),
    usernameInputId: overrideAttr("login.usernameInputId", "login-username-input"),
    passwordInput: overrideAttr("login.passwordInput", "login-password"),
    passwordInputId: overrideAttr("login.passwordInputId", "login-password-input"),
    submitButton: overrideAttr("login.submitButton", "login-submit"),
    errorBanner: overrideAttr("login.errorBanner", "login-error"),
  },
  nav: {
    root: overrideAttr("nav.root", "dashboard-nav"),
    devicesLink: overrideAttr("nav.devicesLink", "nav-link-devices"),
    provisioningLink: overrideAttr("nav.provisioningLink", "nav-link-provisioning"),
    accountLink: overrideAttr("nav.accountLink", "nav-link-account"),
    requestsLink: overrideAttr("nav.requestsLink", "nav-link-requests"),
    logoutButton: overrideAttr("nav.logoutButton", "nav-logout"),
  },
  devices: {
    active: {
      card: overrideAttr("devices.active.card", "table-card"),
      table: overrideAttr("devices.active.table", "data-table"),
      heading: overrideAttr("devices.active.heading", "active-devices-heading"),
      testId: overrideAttr("devices.active.testId", "table-active-devices"),
      row: overrideAttr("devices.active.row", "active-device-row"),
    },
    archived: {
      card: overrideAttr("devices.archived.card", "table-card"),
      table: overrideAttr("devices.archived.table", "data-table"),
      heading: overrideAttr("devices.archived.heading", "archived-devices-heading"),
      testId: overrideAttr("devices.archived.testId", "table-archived-devices"),
      row: overrideAttr("devices.archived.row", "archived-device-row"),
    },
    nameHeaderButton: overrideAttr("devices.nameHeaderButton", "device-sort-name"),
    editAction: overrideAttr("devices.editAction", "device-row-edit"),
    removeAction: overrideAttr("devices.removeAction", "device-row-remove"),
  },
  provisioning: {
    form: overrideAttr("provisioning.form", "provisioning-form"),
    requesterNameInput: overrideAttr("provisioning.requesterNameInput", "provisioning-requester-name"),
    requesterNameInputId: overrideAttr(
      "provisioning.requesterNameInputId",
      "provisioning-requester-name-input",
    ),
    effectiveDateInput: overrideAttr("provisioning.effectiveDateInput", "provisioning-effective-date"),
    effectiveDateInputId: overrideAttr(
      "provisioning.effectiveDateInputId",
      "provisioning-effective-date-input",
    ),
    notesTextarea: overrideAttr("provisioning.notesTextarea", "provisioning-notes"),
    notesTextareaId: overrideAttr("provisioning.notesTextareaId", "provisioning-notes-input"),
    billingCycleSelectId: overrideAttr("provisioning.billingCycleSelectId", "provisioning-billing-cycle"),
    submitButton: overrideAttr("provisioning.submitButton", "provisioning-submit"),
    successBanner: overrideAttr("provisioning.successBanner", "provisioning-success"),
  },
  account: {
    openDeleteButton: overrideAttr("account.openDeleteButton", "open-delete-account"),
    dialog: overrideAttr("account.dialog", "delete-account-dialog"),
    cancelButton: overrideAttr("account.cancelButton", "delete-account-cancel"),
    confirmButton: overrideAttr("account.confirmButton", "delete-account-confirm"),
    deletedBanner: overrideAttr("account.deletedBanner", "account-deleted-banner"),
  },
  wizard: {
    root: overrideAttr("wizard.root", "wizard-root"),
    stepHeading: overrideAttr("wizard.stepHeading", "wizard-step-heading"),
    titleInput: overrideAttr("wizard.titleInput", "wizard-title"),
    titleInputId: overrideAttr("wizard.titleInputId", "wizard-title-input"),
    requestedByInput: overrideAttr("wizard.requestedByInput", "wizard-requested-by"),
    requestedByInputId: overrideAttr("wizard.requestedByInputId", "wizard-requested-by-input"),
    resourceSelectId: overrideAttr("wizard.resourceSelectId", "wizard-resource"),
    durationSelectId: overrideAttr("wizard.durationSelectId", "wizard-duration"),
    reviewSummary: overrideAttr("wizard.reviewSummary", "wizard-review-summary"),
    backButton: overrideAttr("wizard.backButton", "wizard-back"),
    nextButton: overrideAttr("wizard.nextButton", "wizard-next"),
    submitButton: overrideAttr("wizard.submitButton", "wizard-submit"),
    successBanner: overrideAttr("wizard.successBanner", "wizard-success"),
  },
};

export type DomProfile = typeof domProfile;
