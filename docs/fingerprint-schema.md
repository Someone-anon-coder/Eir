# Fingerprint Schema (v1)

Closes `BLUEPRINT.md` §10.2 open question 2 and implements §7.2's field list with
concrete shapes, limits, and defaults. Signed off by Aayush before any capture
code was written (Phase 3, Understanding Gate).

## Design intent

A fingerprint captures an element's **stable identity**, not its full state.
Text-heavy, frequently-changing, or decorative attributes are deliberately
excluded — they were never what Playwright locators reliably target, and
including them would make fingerprints noisy and diffs unreadable (Blueprint
P7). Every field below earns its place by contributing to _distinguishing this
element from its neighbors_, not by being "more data."

## Shape

```ts
interface Fingerprint {
  readonly v: 1;
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly text: string | null;
  readonly label: string | null;
  readonly ancestors: readonly AncestorHop[];
  readonly siblingIndex: number;
  readonly siblingCount: number;
  readonly bbox: QuantizedBoundingBox;
}

interface AncestorHop {
  readonly tag: string;
  readonly id: string | null;
  readonly classes: readonly string[];
}

interface QuantizedBoundingBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
```

## Field-by-field

| Field                           | What                                                                           | Why                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `v`                             | Schema version literal (`1`)                                                   | Future schema changes bump this; old entries are recognizably stale, never silently misread.                            |
| `tag`                           | Lowercase tag name                                                             | Cheapest, strongest signal; also drives tag-swap candidate generation in Phase 5 (`button ↔ a ↔ input[type=submit]`).   |
| `attrs`                         | Fixed allow-list, present-only                                                 | See below.                                                                                                              |
| `text`                          | Own rendered text, trimmed/collapsed, ≤100 chars                               | Identity signal for buttons/links/headers; bounded so it can't dominate the fingerprint or leak arbitrary page content. |
| `label`                         | Associated label text only (`for=` or wrapping `<label>`), same 100-char limit | Kept separate from `attrs["aria-label"]` so the two never duplicate the same signal under two names.                    |
| `ancestors`                     | 3 hops up, nearest parent first, filtered classes                              | Structural context without capturing the whole DOM path.                                                                |
| `siblingIndex` / `siblingCount` | Position among same-tag siblings under the same parent                         | Directly serves the two-similar-tables / near-duplicate-sibling stress case (NOTES.md NOTE-002).                        |
| `bbox`                          | Quantized geometry                                                             | Coarse position as a last-resort disambiguator (Blueprint §6: geometry never drives matching alone).                    |

### `attrs` allow-list

Only these keys, and only when present on the element:

- `id`
- `name`
- `type`
- `data-testid`
- `role`
- any `aria-*` attribute (captured generically by prefix match)

**Excluded, by decision:** `class` (handled separately, see `ancestors`), `style`,
any `data-*` attribute other than `data-testid`, `href`/`src`. None of these are
named in Blueprint §7.2's field list; `href`/`src` in particular can carry
volatile or environment-specific values. If a real need surfaces later, that's
a deliberate allow-list edit — not a default-on capture.

### Text truncation (`text`, `label`)

**100 characters**, whitespace-collapsed and trimmed, hard-cut with a trailing
`…` marker when truncated (the marker is for human diff-readability only — the
cut point itself is not treated as a stable identity feature). This is the one
number the approach doc left fully open; 100 chars comfortably covers button/
link/header labels while keeping fingerprints small (Blueprint §7.3's 1–3 KB
per-fingerprint budget) and refusing to treat paragraph-length content as an
identity signal.

### Ancestor hop count and class filtering

**3 hops**, stopping early at `<body>`/`<html>` if reached first. Each hop's
`classes` list is _filtered_, not the raw `classList` — Tailwind-style utility
tokens are stripped, keeping only tokens that look like semantic/component
class names (the kind Ward's own components use, e.g. `data-table`,
`wizard-step`).

Filter heuristic (a token is dropped as "utility noise" if it matches any of):

```
^(flex|grid|block|inline|hidden|contents)$
^(inline-block|inline-flex|inline-grid|table|table-cell|table-row)$
^(absolute|relative|fixed|sticky|static)$
^(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y)-
^(w|h|min-w|min-h|max-w|max-h)-
^(text|bg|border|rounded|shadow|opacity|z|top|bottom|left|right|font|leading|tracking|divide|ring|outline|from|via|to)-?
^(items|justify|content|self|place)-
^(overflow|cursor|transition|duration|ease|animate|scale|rotate|translate|skew)-?
^(sr-only|not-sr-only|truncate|antialiased)$
^(hover|focus|active|disabled|visited|group-hover|peer-focus|first|last|odd|even):/
^(sm|md|lg|xl|2xl|dark):/
```

Anything not matching survives as "salient." The list is a plain regex array
in code (`packages/eir/src/classFilter.ts`, written next) — readable and
amendable, not a black box.

### Bounding box quantization

**32px grid**: each of `x`, `y`, `w`, `h` rounds to the nearest 32 via
`Math.round(v / 32) * 32`. Small reflows (a few px from a font load, a
sibling's height change) round away instead of registering as an identity
change.

Non-nullable by decision: if the element isn't measurable at capture time
(detached, zero rect), the **entire capture is treated as a failure and
skipped** — logged, never partially written. This keeps every downstream
consumer (Phase 5's matcher) working against a fully-populated shape instead
of null-checking bbox everywhere.

## Deliberately not captured

Per Blueprint P7 and §7.2 verbatim: raw input values, timestamps, full
(unfiltered) class lists, and anything beyond the two bounded free-text
fields above. `NOTE-001`'s optional post-condition field is a candidate
_future_ addition to this schema — not decided or implemented this phase;
formal adoption decision is Phase 5.
