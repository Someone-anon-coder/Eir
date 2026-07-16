# playwright-eir

Self-healing locator engine for Playwright. A fixture override that
fingerprints elements while your suite is green, and when a selector
breaks, matches the element's new identity against that fingerprint and
suggests (or, if you opt in, retries against) a fix. Never edits your
source files; never heals a query method (`isVisible`, `count`, …); a
selector it never fingerprinted fails exactly like vanilla Playwright.

## Install

```bash
npm i -D playwright-eir
```

```ts
// before
import { test, expect } from "@playwright/test";

// after
import { test, expect } from "playwright-eir";
```

That's the whole integration — `EirPage`/`EirLocator` structurally
implement Playwright's real `Page`/`Locator` types.

## Before you enable anything

1. Set `use.actionTimeout` to a bounded value (e.g. `5_000`) in your
   `playwright.config.ts` — otherwise a broken selector takes a full test
   timeout to diagnose instead of a fast, bounded one.
2. Wire the reporter: `reporter: [["list"], ["playwright-eir/reporter"]]`.
3. Run your suite green once so a `.eir/routes/*.json` calibration
   baseline exists — there's nothing to match against on a selector's
   first run.

## Results (measured, seed 42, 8-class mutation benchmark)

| Mutation class | Heal rate | False-heal rate |
|---|---:|---:|
| id-rename | 75.0% | 0.0% |
| text-change | 87.5% | 0.0% |
| tag-swap | 100.0% | 0.0% |
| class-shuffle | 25.0% | 0.0% |
| sibling-reorder | 0.0% | 0.0% |
| wrapper-inject | 100.0% | 0.0% |
| near-duplicate-sibling-swap | 25.0% | 0.0% |
| compound-release | 50.0% | 0.0% |

False-heal rate is 0.0% across every class, every measured run — the
number this project is actually optimized for. `class-shuffle` and
`sibling-reorder` are documented structural ceilings, not tuning gaps.

Full results table, failure-mode analysis, config reference, architecture
sketch, known limitations, and the complete tuning/measurement history:
**[github.com/Someone-anon-coder/Eir](https://github.com/Someone-anon-coder/Eir)**

## License

MIT
