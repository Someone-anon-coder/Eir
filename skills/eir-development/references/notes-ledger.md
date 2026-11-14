# The `NOTES.md` ledger

`NOTES.md` is the project's working memory. Anything that is not the current
task but should not be lost goes here in the same session it comes up. Other
documents, commits, and PRs refer to its entries by ID, so the IDs are
permanent.

## Sections

| #   | Section                          | Holds                                                                                        |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | Parked Items                     | `NOTE-###`: ideas, gaps, and scope additions deferred on purpose                             |
| 2   | Open Questions                   | `Q-###`: decisions needed (a threshold, a name, a config shape)                              |
| 3   | Risk Register                    | `RISK-###`: things that could break the project or its claims                                |
| 4   | Decisions Already Made           | Index pointing at where decisions are recorded                                               |
| 5   | Daily Progress Log               | One entry per working session                                                                |
| 6   | Changelog to Governing Documents | One entry per deliberate edit to `BLUEPRINT.md`, `EIR_BLUEPRINT_APPROACH.md`, or `CLAUDE.md` |

Each section starts with its own entry template. Copy it exactly.

## IDs

Three independent counters, zero-padded to three digits, never reused, never
renumbered, even for rejected entries. Find the next free one before writing:

```bash
grep -o 'NOTE-[0-9]\{3\}' NOTES.md | sort -u | tail -1
grep -o 'RISK-[0-9]\{3\}' NOTES.md | sort -u | tail -1
grep -o 'Q-[0-9]\{3\}'    NOTES.md | sort -u | tail -1
```

Entries are not in numeric order in the file. Search for an ID; do not scroll
for it.

## Statuses

| Kind | Status              | Meaning                                        |
| ---- | ------------------- | ---------------------------------------------- |
| NOTE | `PARKED`            | Recorded, no decision due yet                  |
| NOTE | `DUE`               | Must be decided now                            |
| NOTE | `RESOLVED`          | Decided and done; says where (doc, commit, PR) |
| NOTE | `REJECTED`          | Considered and declined; says why              |
| Q    | `OPEN` / `ANSWERED` | An answer includes its reasoning               |
| RISK | `WATCHING`          | Live; mitigation or tripwire stated            |
| RISK | `MITIGATED`         | Handled; says how                              |
| RISK | `MATERIALIZED`      | It happened; says what was done                |

A status that stays `PARKED` or `WATCHING` is acceptable only when the entry
says why it is staying that way. Some are permanent by design (for example a
risk watched through a CI tripwire).

## When to write what

- An improvement you noticed outside the current task: new `NOTE`, status
  `PARKED`. Then return to the task. Do not implement it.
- A bug or weakness you found but are not fixing now: new `RISK` (or `NOTE` if
  it is a capability gap) with how it was observed.
- A value or design choice you had to guess: new `Q`, and label the guess as
  an estimate wherever it appears.
- Work that closes an entry: change its status and fill in the resolution,
  with the PR number. Then grep for the ID across the repo and update every
  place that still describes it as open (`README.md`, `docs/`,
  `FULL_UNDERSTANDING.md`). Stale cross-references have been the most common
  bookkeeping error in this project.
- An edit to a governing document: add a section 6 entry in the same PR,
  stating what changed, why, and what triggered it.

## Daily Progress Log entry

```markdown
### 2026-07-17 — <scope>, <work item>

- Did: <1-3 lines>
- Blocked/open: <none, or the NOTE/Q/RISK it became>
- CI: green | red (<why>)
- Next: <where the next session picks up>
```

Use the actual date. Write what happened, including what did not work.

## Wording

Entries are evidence. Write what was observed and how ("ran X, saw Y"), keep
measured and estimated values distinguishable, and do not soften a negative
result. Do not rewrite an old entry's history; append a dated follow-up
paragraph to it instead.
