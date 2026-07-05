/**
 * Single source of truth for every id / data-testid / structural class
 * Ward's components render. Phase 4's mutation engine will work by
 * swapping this object, not by patching component source — see
 * CLAUDE.md §7.2 and EIR_BLUEPRINT_APPROACH.md Phase 1, work item 2.
 */
export const domProfile = {
  login: {
    form: "login-form",
    usernameInput: "login-username",
    usernameInputId: "login-username-input",
    passwordInput: "login-password",
    passwordInputId: "login-password-input",
    submitButton: "login-submit",
    errorBanner: "login-error",
  },
  nav: {
    root: "dashboard-nav",
    devicesLink: "nav-link-devices",
    provisioningLink: "nav-link-provisioning",
    accountLink: "nav-link-account",
    requestsLink: "nav-link-requests",
    logoutButton: "nav-logout",
  },
  devices: {
    active: {
      card: "table-card",
      table: "data-table",
      heading: "active-devices-heading",
      testId: "table-active-devices",
      row: "active-device-row",
    },
    archived: {
      card: "table-card",
      table: "data-table",
      heading: "archived-devices-heading",
      testId: "table-archived-devices",
      row: "archived-device-row",
    },
    nameHeaderButton: "device-sort-name",
    editAction: "device-row-edit",
    removeAction: "device-row-remove",
  },
  provisioning: {
    form: "provisioning-form",
    requesterNameInput: "provisioning-requester-name",
    requesterNameInputId: "provisioning-requester-name-input",
    effectiveDateInput: "provisioning-effective-date",
    effectiveDateInputId: "provisioning-effective-date-input",
    notesTextarea: "provisioning-notes",
    notesTextareaId: "provisioning-notes-input",
    billingCycleSelectId: "provisioning-billing-cycle",
    submitButton: "provisioning-submit",
    successBanner: "provisioning-success",
  },
  account: {
    openDeleteButton: "open-delete-account",
    dialog: "delete-account-dialog",
    cancelButton: "delete-account-cancel",
    confirmButton: "delete-account-confirm",
    deletedBanner: "account-deleted-banner",
  },
  wizard: {
    root: "wizard-root",
    stepHeading: "wizard-step-heading",
    titleInput: "wizard-title",
    titleInputId: "wizard-title-input",
    requestedByInput: "wizard-requested-by",
    requestedByInputId: "wizard-requested-by-input",
    resourceSelectId: "wizard-resource",
    durationSelectId: "wizard-duration",
    reviewSummary: "wizard-review-summary",
    backButton: "wizard-back",
    nextButton: "wizard-next",
    submitButton: "wizard-submit",
    successBanner: "wizard-success",
  },
} as const;

export type DomProfile = typeof domProfile;
