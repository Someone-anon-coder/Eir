# demo-app ("Ward")

A deliberately boring, "enterprise furniture" React + Vite app: login, a
dashboard nav, a devices table (two visually similar tables on one route —
the false-heal bait, see `EIR_BLUEPRINT_APPROACH.md` Phase 1), a multi-field
provisioning form, an account-deletion modal, and a hash-routed 3-step
access-request wizard.

This app exists to be tested against, not to be a good product. It is the
benchmark spine's foundation (Q1) — every Eir capability from Phase 2 onward
is exercised against this app's DOM.

## Commands

```bash
pnpm --filter demo-app dev       # serve Ward at http://localhost:5173
pnpm --filter demo-app e2e       # run the vanilla-Playwright reference suite
pnpm --filter demo-app typecheck
```

## Opt-in flags for the healer comparison

All additions are behind env flags. With none set, Ward renders exactly what
it always did, and the seed-42 8-class baseline is byte-identical (also on a
marked build, because Eir's fingerprint allow-list never reads `data-eir-gt`).

| Flag                                        | Effect                                                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_EIR_GT_MARKERS=1`                     | Renders `data-eir-gt="<area.element>"` on every element any mutation targets. Judge-only: the healer always runs against the build with this off. |
| `VITE_EIR_GT_COLLECTOR=<url>`               | With markers on, reports each click/input/change (the nearest marked element, plus the marked ancestor path) to the judge's local collector.      |
| `payload.regress` (in `VITE_EIR_MUTATIONS`) | `real-regression`: genuine app bugs where every selector still resolves. Correct tool behaviour is red stays red.                                 |
| `payload.flow` (in `VITE_EIR_MUTATIONS`)    | `flow-change`: structural UI changes beyond selector drift.                                                                                       |

`real-regression` targets (7): `devices.saveIgnoresEdit` (Save closes edit mode
but drops the edit), `provisioning.successBecomesError` (success banner reads
as an error), `account.confirmDoesNothing`, `wizard.reviewShowsWrongValue`
(review shows the title as "Requested By"), `wizard.submitDoesNothing`,
`devices.removeKeepsRow`, `login.acceptsEmptyPassword`.

`flow-change` targets (5): `account.deleteInOverflow` (Delete Account moves
into a "More actions" menu), `provisioning.confirmStep` (extra confirmation
after Submit), `wizard.termsStep` (extra terms step before review),
`devices.removeConfirm` (Remove needs a confirm click), `nav.logoutInMenu`
(Log Out moves into a user menu).

These two classes were added as a counterweight: the original eight were
designed by the same person as the matcher they measure. Selection runs
through the benchmark's seeded PRNG; the pools are currently small enough that
every target is live and the seed only fixes the order. Not part of
`bench:all` or the committed baseline.

## Structure

- `src/domProfile.ts` — single source of truth for every id / data-testid /
  structural class the app renders. Phase 4's mutation engine will work by
  swapping this object, not by patching component source.
- `src/pages/` — the five app surfaces.
- `tests/pom/` — Page Object classes used by the POM half of the reference
  suite (`tests/pom-suite/`).
- `tests/linear-suite/` — the other half of the reference suite, written
  inline rather than through page objects, with deliberately mixed selector
  quality (ids, class-anchored XPath, text-based) to mirror real production
  suites.

No `playwright-eir` import appears anywhere in `tests/` — the suite stays
100% vanilla `@playwright/test` until Phase 2's import-swap proof.
