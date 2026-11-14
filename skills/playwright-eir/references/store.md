# The `.eir/` fingerprint store

The store is Eir's memory of what each element looked like the last time the
suite passed. It lives in `.eir/` in the directory Playwright runs from.

```
.eir/
  routes/
    dashboard__account.json                  fingerprints        (commit)
    dashboard__account.postconditions.json   post-conditions     (commit)
  .shards/                                   per-worker scratch  (gitignore)
  .shards-postconditions/                    per-worker scratch  (gitignore)
```

## Lifecycle

1. During a run, each worker writes what it captured to its own shard file.
   A fingerprint is recorded only when the action on that element succeeded.
2. After all workers finish, `playwright-eir/globalTeardown` merges the shards
   into `routes/` and removes the shard directories. Without that teardown
   the shards pile up and `routes/` is never written.
3. Each successful action overwrites that selector's entry with what the
   element looks like now (last known good). Entries for selectors the run
   did not touch are kept.

Output is deterministic: keys are sorted and writes are atomic, so the same
suite against the same UI gives byte-identical files regardless of worker
count. A diff in `routes/` means the UI, the tests, or the selectors changed.

## File naming

One pair of files per route. The route is the page's normalized pathname, with
`/` written as `__`: `/dashboard/requests/new` becomes
`dashboard__requests__new.json`. The root path `/` is `index.json`. Numeric and
UUID path segments collapse to `:id`, so `/plan/42/edit` and `/plan/57/edit`
share one route (`/plan/:id/edit`, stored as `plan__id__edit.json`). Other dynamic
segments (slugs, usernames) need a `routeOverrides` entry in the Eir config, or
every distinct URL gets its own file.

## Fingerprint file

A JSON object keyed by selector, in the same notation `eir-report.json` uses
for `selectorKey`. An illustrative entry (real files are key-sorted):

```json
{
  "getByTestId(\"open-delete-account\")": {
    "v": 1,
    "tag": "button",
    "attrs": { "data-testid": "open-delete-account", "type": "button" },
    "text": "Delete Account",
    "label": null,
    "ancestors": [{ "tag": "section", "id": null, "classes": ["danger-zone"] }],
    "siblingIndex": 0,
    "siblingCount": 1,
    "bbox": { "x": 32, "y": 256, "w": 128, "h": 32 }
  }
}
```

| Field                          | Content                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `v`                            | Schema version. Always `1`.                                                                                  |
| `tag`                          | Lowercase tag name.                                                                                          |
| `attrs`                        | Only `id`, `name`, `type`, `data-testid`, `role`, and `aria-*`, when present.                                |
| `text`                         | The element's own text, whitespace-collapsed, at most 100 characters.                                        |
| `label`                        | Text of the associated `<label>`, same limit.                                                                |
| `ancestors`                    | Up to 3 parents, nearest first: tag, id, and class names with utility classes (Tailwind-style) filtered out. |
| `siblingIndex`, `siblingCount` | Position among same-tag siblings.                                                                            |
| `bbox`                         | Position and size rounded to a 32px grid.                                                                    |

Not stored: the element's own class list, input values, `href`/`src`, other
`data-*` attributes, or any DOM snapshot. Two consequences worth knowing:

- An element identified only by its own classes has little for Eir to match
  on once those classes change.
- The files hold visible labels and attribute values from the app under test.
  If test data includes personal or secret text in button labels or
  `aria-label`s, it will be committed with the store.

## Post-condition file

Keyed the same way. Records what the page did right after the action, so a
healed retry can be checked against it.

```json
{
  "getByRole(\"link\", {\"name\":\"Access Requests\"})": {
    "v": 1,
    "kind": "route-change",
    "toRoute": "/dashboard/requests/new"
  },
  "getByTestId(\"open-delete-account\")": {
    "v": 1,
    "kind": "dom-count-change",
    "sign": "increased"
  },
  "getByTestId(\"plan-name\")": { "v": 1, "kind": "none" }
}
```

| `kind`             | Meaning                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `route-change`     | The action navigated to `toRoute`.                                                          |
| `dom-count-change` | The page's element count went up (`increased`, e.g. a dialog opened) or down (`decreased`). |
| `none`             | Nothing observable happened (typical for `fill`).                                           |

`dom-count-change` entries can occasionally flip to `none` and back between
otherwise identical runs, when the page had not finished reacting at the
moment it was sampled. This only ever makes verification more lenient to
skip, never more likely to accept a wrong heal. If a post-conditions diff
shows only such flips and the UI did not change, discard it.

## Working with the store

**Reviewing a diff.** Read it like a snapshot update. An `attrs.id` change
means the id was renamed; a `tag` change means the element type changed; a
`bbox` change alone is layout. A diff nobody can explain from the PR's own
changes is worth a question.

**Merge conflicts.** Do not hand-merge. Take either side, re-run the suite
green on the merged branch, and commit what it writes.

**Recalibrating.** To rebuild from nothing, delete `.eir/routes/` and run the
suite green. Until that run completes there is no baseline, so do it on a
passing build, never to make a failure go away.

**Stale entries.** Entries for deleted tests or removed selectors are not
pruned automatically. They are harmless; recalibrate to drop them.

**Renamed selector.** After applying a suggestion, the new selector gets its
own entry on the next green run. The old key stays until recalibration.

**Never edit by hand.** The files are generated. Exclude `.eir/` from
formatters (for Prettier, add `**/.eir/` to `.prettierignore`) so the
deterministic output is not reformatted.

**Partial runs.** Running a subset of tests only refreshes the entries those
tests touch. That is safe.

**CI.** CI should match against the committed baseline, so `routes/` must be
in the checkout. CI runs do not need to commit anything back.
