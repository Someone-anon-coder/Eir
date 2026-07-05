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
