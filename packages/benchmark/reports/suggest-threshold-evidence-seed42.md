# suggestThreshold evidence — seed 42

Generated 2026-07-17T06:38:43.864Z. Heuristics-only, `suggest-only` mode (the standing baseline's own measurement lens) across all 8 mutation classes.

## Probe census

| Total probes | Passed (mutation-ineffective) | Failed, no attempt | No-candidates | Rejected | Matched |
|---:|---:|---:|---:|---:|---:|
| 80 | 0 | 14 | 0 | 0 | 66 |

## Matched-attempt confidence distribution

count=66, min=0.5849, max=1.0000, mean=0.8211, median=0.8393

| Bucket | Count |
|---|---:|
| [0.0, 0.1) | 0 |
| [0.1, 0.2) | 0 |
| [0.2, 0.3) | 0 |
| [0.3, 0.4) | 0 |
| [0.4, 0.5) | 0 |
| [0.5, 0.6) | 2 |
| [0.6, 0.7) | 11 |
| [0.7, 0.8) | 11 |
| [0.8, 0.9) | 24 |
| [0.9, 1.0] | 18 |

## Matched attempts below the current DEFAULT_SUGGEST_THRESHOLD (0.3)

None. Every real `matched` attempt this run scored at or above the current 0.3 floor — no genuinely low-confidence match exists in this data to anchor a lower (or higher) number against.

## All matched attempts (raw)

| Class | Target | Confidence | Margin |
|---|---|---:|---:|
| class-shuffle | class-shuffle.devices.archived.card | 0.5849 | 0.1774 |
| class-shuffle | class-shuffle.devices.active.card | 0.6000 | 0.1774 |
| class-shuffle | class-shuffle.devices.pageClassName | 0.6161 | 0.3341 |
| compound-release | text-change.account.openDeleteButton | 0.6220 | 0.3038 |
| compound-release | text-change.account.confirmButton | 0.6220 | 0.3038 |
| compound-release | id-rename.account.openDeleteButton | 0.6220 | 0.3038 |
| id-rename | id-rename.login.usernameInputId | 0.6250 | 0.2732 |
| id-rename | id-rename.login.usernameInput | 0.6250 | 0.2732 |
| compound-release | id-rename.login.usernameInputId | 0.6250 | 0.2732 |
| compound-release | id-rename.login.usernameInput | 0.6250 | 0.2732 |
| class-shuffle | class-shuffle.provisioning.pageClassName | 0.6312 | 0.3117 |
| class-shuffle | class-shuffle.account.pageClassName | 0.6312 | 0.3169 |
| class-shuffle | class-shuffle.nav.layoutClassName | 0.6370 | 0.1765 |
| wrapper-inject | wrapper-inject.provisioning.notesTextarea | 0.7175 | 0.7175 |
| id-rename | id-rename.provisioning.submitButton | 0.7353 | 0.4365 |
| id-rename | id-rename.account.openDeleteButton | 0.7353 | 0.4078 |
| compound-release | id-rename.provisioning.submitButton | 0.7353 | 0.4365 |
| wrapper-inject | wrapper-inject.wizard.requestedByInput | 0.7570 | 0.5111 |
| near-duplicate-sibling-swap | near-dup.saveCancel.dev-3.cancel | 0.7765 | 0.0168 |
| text-change | text-change.wizard.nextButtonStep1 | 0.7782 | 0.3676 |
| compound-release | text-change.wizard.nextButtonStep1 | 0.7782 | 0.3676 |
| compound-release | sibling-reorder.wizard.resourceSelect | 0.7782 | 0.3676 |
| compound-release | sibling-reorder.wizard.durationSelect | 0.7782 | 0.3676 |
| near-duplicate-sibling-swap | near-dup.saveCancel.dev-5.cancel | 0.7815 | 0.0268 |
| id-rename | id-rename.provisioning.requesterNameInput | 0.8125 | 0.4365 |
| id-rename | id-rename.wizard.titleInput | 0.8125 | 0.4475 |
| id-rename | id-rename.wizard.requestedByInput | 0.8125 | 0.4475 |
| compound-release | id-rename.provisioning.requesterNameInput | 0.8125 | 0.4365 |
| compound-release | id-rename.wizard.titleInput | 0.8125 | 0.4475 |
| compound-release | id-rename.wizard.requestedByInput | 0.8125 | 0.4475 |
| wrapper-inject | wrapper-inject.provisioning.effectiveDateInput | 0.8219 | 0.5490 |
| id-rename | id-rename.login.passwordInputId | 0.8393 | 0.4875 |
| compound-release | id-rename.login.passwordInputId | 0.8393 | 0.4875 |
| near-duplicate-sibling-swap | near-dup.accountModal.confirm | 0.8627 | 0.4110 |
| wrapper-inject | wrapper-inject.account.confirmButton | 0.8664 | 0.4688 |
| text-change | text-change.nav.logoutButton | 0.8674 | 0.5159 |
| compound-release | text-change.nav.logoutButton | 0.8674 | 0.5159 |
| text-change | text-change.nav.requestsLink | 0.8687 | 0.4637 |
| compound-release | text-change.nav.requestsLink | 0.8687 | 0.4637 |
| wrapper-inject | wrapper-inject.wizard.titleInput | 0.8809 | 0.5152 |
| near-duplicate-sibling-swap | near-dup.wizardFields.title | 0.8848 | 0.5091 |
| text-change | text-change.account.openDeleteButton | 0.8867 | 0.5685 |
| text-change | text-change.account.confirmButton | 0.8867 | 0.5685 |
| text-change | text-change.nav.provisioningLink | 0.8882 | 0.5035 |
| compound-release | text-change.nav.provisioningLink | 0.8882 | 0.5035 |
| text-change | text-change.nav.accountLink | 0.8896 | 0.5151 |
| compound-release | text-change.nav.accountLink | 0.8896 | 0.5151 |
| wrapper-inject | wrapper-inject.provisioning.requesterNameInput | 0.8969 | 0.5490 |
| class-shuffle | class-shuffle.devices.archived.table | 0.9084 | 0.4743 |
| tag-swap | tag-swap.account.openDeleteButton | 0.9105 | 0.5349 |
| tag-swap | tag-swap.account.confirmButton | 0.9105 | 0.5349 |
| tag-swap | tag-swap.provisioning.submitButton | 0.9105 | 0.6117 |
| tag-swap | tag-swap.nav.logoutButton | 0.9118 | 0.4720 |
| tag-swap | tag-swap.nav.devicesLink | 0.9118 | 0.5270 |
| wrapper-inject | wrapper-inject.account.openDeleteButton | 0.9118 | 0.5843 |
| class-shuffle | class-shuffle.devices.active.table | 0.9285 | 0.4643 |
| wrapper-inject | wrapper-inject.account.cancelButton | 0.9420 | 0.4626 |
| text-change | text-change.devices.archivedRowName | 0.9929 | 0.0041 |
| near-duplicate-sibling-swap | near-dup.editRemove.dev-2.edit | 0.9929 | 0.0000 |
| near-duplicate-sibling-swap | near-dup.editRemove.dev-4.edit | 0.9929 | 0.0041 |
| tag-swap | tag-swap.nav.accountLink | 0.9950 | 0.5969 |
| near-duplicate-sibling-swap | near-dup.table-row.archived | 0.9950 | 0.0100 |
| near-duplicate-sibling-swap | near-dup.editRemove.dev-9.remove | 0.9950 | 0.0100 |
| compound-release | text-change.devices.archivedRowName | 0.9950 | 0.0062 |
| tag-swap | tag-swap.nav.provisioningLink | 1.0000 | 0.6152 |
| tag-swap | tag-swap.nav.requestsLink | 1.0000 | 0.5969 |

