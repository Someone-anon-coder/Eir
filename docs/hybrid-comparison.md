# Hybrid Comparison — Heuristics-Only vs Gemini Fallback

Companion to `docs/tuning-log.md` and `docs/phase5-results.md` (the
heuristic engine's own tuning history and narrative) and
`packages/benchmark/reports/hybrid-comparison.json`/`.md` (the
machine-generated artifact from this document's final real run). This
document carries Phase 8's Definition-of-Done narrative: the honest
verdict on whether the LLM fallback helps, stated with the same energy
whether the answer is a win or not (CLAUDE.md §10).

---

## Methodology

The suggestion-cap (Blueprint P4 applied to AI, `packages/eir/src/fallback/trigger.ts`)
means the fallback can **never** change a row's classified outcome
(healed-correct / healed-wrong / suggested / missed) — it only ever adds
a suggestion-strength annotation to a row heuristics already decided.
Consequently, re-running the mutated suite without the fallback would
reproduce the already-committed, already-proven-deterministic
`packages/benchmark/results/*.json` baseline byte-for-byte (Phase 3/4's
own determinism proofs). This comparison therefore does exactly one new
thing per class: run the mutated suite once more with the fallback
opted in (`EIR_BENCH_FALLBACK=1`, suggest-only mode — the shipped
default posture), and record what the LLM said for the rows that
triggered it. The **heuristics-only side of every table below is the
existing committed baseline** (`packages/benchmark/reports/baseline.md`,
seed 42, unchanged this phase) — the **hybrid side is additive real
evidence**, not a parallel rerun of the whole suite.

**A process note, stated plainly rather than smoothed over:** five real
runs were made this session across two API keys. The first run produced
the richest sample (20 invocations, 13 real successful verdicts) but its
backing JSON was overwritten by two subsequent reruns before being
copied aside — a genuine mistake, not a data-quality problem with the
run itself. The numbers below combine that run's console-captured
summary with the fully file-backed detail from the other four runs.
Where a specific number is transcript-recovered rather than
file-verifiable, it's marked so.

## The trigger predicate — validated twice, exactly

Two of the five runs completed all 8 classes without early truncation
and recorded **exactly 21 invocations** — precisely the census predicted
at this phase's Cost Gate from the committed baseline's per-class
suggested/missed rows (id-rename 2, text-change 1, class-shuffle 6,
near-duplicate-sibling-swap 6, compound-release 6; zero for tag-swap,
sibling-reorder, and wrapper-inject — the last because a sibling-reorder
failure never throws at all, RISK-009, so no match attempt and no
shortlist ever exists to hand the model). The trigger contract fires on
exactly the rows it was designed to and no others, confirmed by real
measurement, not just unit tests.

## Finding 1 — free-tier reliability is a real, measured adoption cost

| Run | Key | Invocations attempted | Real responses | No-verdict (rate-limited) | Notes |
|---|---|---:|---:|---:|---|
| 1 | key A | 20 | 13 | 7 | richest sample; **JSON overwritten, console-recovered** |
| 2 | key A | 21 | 0 | 21 | 20×`http-429`, 1×`http-503` |
| 3 | key A | 21 | 0 | 21 | 21×`http-429` — cooldown did not help (daily, not per-minute, cap) |
| 4 | key B (fresh, still free tier) | 10 of ~19 expected | 3 | 7 | suite truncated early under elevated real latency — see below |

**Total: 74 invocation attempts, 17 real responses (23%), 57 clean
`no-verdict` degradations.** Every single `no-verdict` was a genuine
HTTP failure from Google's side (429 rate-limit or 503 overload) —
`GeminiProvider` never crashed, never guessed, and no Playwright test in
any run failed *because of* the fallback. This is the suggestion-cap's
sibling contract (constraint 5: an invalid or unavailable response is a
distinct no-verdict outcome, never an exception) working exactly as
designed, under real and fairly aggressive pressure. The honest
adoption-relevant finding is separate from that: **a free-tier Gemini
key cannot reliably service even this benchmark's small ~21-call
comparison run in one sitting.** Run 4's undercount (10 of an expected
~19 rows even attempted) suggests real elevated latency under
throttling can push an individual probe past its own test timeout
before the fallback call resolves — a benchmark-harness observation, not
an engine defect (the shipped engine has no retry logic to get stuck in;
each row makes at most one attempt).

## Finding 2 — when the LLM answers, it never disagrees with heuristics

Across all 17 real responses observed this session, **every single one
was `endorsed`** — the model chose candidate 0, the heuristic's own
top-ranked (and, per Phase 5's independently measured 0.0% false-heal
rate across every class, already-correct) candidate. Zero
`contradicted`, zero `alternative`, zero `none-of-them`.

| Verdict | Count | Share of real responses |
|---|---:|---:|
| endorsed | 17 | 100% |
| contradicted | 0 | 0% |
| alternative | 0 | 0% |
| none-of-them | 0 | 0% |

This holds across every class that fired, including
`near-duplicate-sibling-swap` — the one class with a genuine adversarial
distractor pair — where the model saw the same knife-edge margins
(e.g. `near-dup.table-row`'s measured 0.8457 confidence / 0.0085 margin,
documented in `docs/phase5-results.md`) and still landed on the same
answer heuristics already had. **No case was observed, in real usage
this session, where the LLM caught something heuristics missed or
corrected something heuristics got wrong.**

## Cost and latency — measured vs. the Cost Gate's prediction

| Metric | Predicted (Cost Gate, 2026-07-15) | Measured (17 real calls) |
|---|---|---|
| Model | `gemini-2.5-flash-lite` | same |
| Input tokens/call | ~880 (full 5-candidate shortlist) | 684–1143 (shortlists in this run were smaller than 5 for several classes; in range) |
| Output tokens/call | ~50–100 | 58–73 |
| Latency/call | ~1s | **1.4s–2.4s — a real, honest miss on the low side** |
| Cost/call | ~$0.00013 | ~$0.0001–0.00014 (accurate) |
| Invocations/full run | 21 | 21 confirmed (twice); partial runs also consistent with 21 as the true census |
| Total session cost | <$0.02 budget | **≈$0.002 actually spent — well under budget** |

The latency prediction undershot by roughly 50–140%. Flash-Lite's
real-world response time for this structured-output shape runs closer
to 1.5–2s than the ~1s estimated from general model-card figures; an
adopter should budget for that, not the optimistic number.

## Per-class accuracy delta

| Class | Heuristics-only (heal/false-heal/suggest/miss) | Hybrid — does the classified outcome change? |
|---|---|---|
| id-rename | 75.0% / 0.0% / 25.0% / 0.0% | **No** — fallback verdicts are suggestion-capped; classified outcome is identical by construction |
| text-change | 87.5% / 0.0% / 12.5% / 0.0% | No |
| tag-swap | 100.0% / 0.0% / 0.0% / 0.0% | No (never fires — heal-qualified) |
| class-shuffle | 25.0% / 0.0% / 75.0% / 0.0% | No |
| sibling-reorder | 0.0% / 0.0% / 0.0% / 100.0% | No (never fires — RISK-009, never throws) |
| wrapper-inject | 100.0% / 0.0% / 0.0% / 0.0% | No (never fires — heal-qualified) |
| near-duplicate-sibling-swap | 25.0% / 0.0% / 75.0% / 0.0% | No |
| compound-release | 50.0% / 0.0% / 25.0% / 25.0% | No |

**The accuracy delta is 0.0 percentage points on every class, by
construction, not by measurement luck.** This is the direct, intended
consequence of the suggestion-cap (Gate 2): there is no code path by
which a fallback verdict could move a row from `suggested` to `healed`,
or from `missed` to anything else. Reporting a delta here isn't really
a benchmark result so much as a restatement of the type system — worth
stating plainly rather than dressing up as a finding.

## The honest verdict

**The LLM fallback does not beat heuristics on this benchmark, and the
real evidence gathered this session gives no indication it would with
more data.** Every real verdict observed agreed with the heuristic's
own already-correct answer; none caught anything heuristics missed. Per
the approach doc's own framing, this is a fully successful phase result,
not a disappointing one — arguably more interview-valuable than a win,
because it was measured rather than assumed, and the measurement
required building the entire suggestion-capped, schema-validated,
gracefully-degrading pipeline regardless of what the numbers said.

Two caveats an adopter should weigh, both real and both against
enabling it by default:

1. **No demonstrated accuracy benefit** on any of this benchmark's 8
   mutation classes, including the one (`near-duplicate-sibling-swap`)
   specifically designed to be hard.
2. **Free-tier reliability is poor enough to be a practical concern.**
   77% of this session's real invocation attempts degraded to
   `no-verdict` from rate limiting alone, across two separate keys.

### Recommendation

**Leave the fallback disabled by default (as shipped) and do not
recommend enabling it for the failure shapes this benchmark exercises.**
If a future adopter has failure shapes this benchmark's 8 classes don't
cover — genuinely novel ambiguity the heuristic scorers were never
tuned against — the fallback remains available as an opt-in,
suggestion-only second opinion, with the understanding that a paid
Gemini tier is likely necessary for it to respond reliably at any real
volume. The engine-level contract (never heal, never retry, never
crash, always a diagnosable outcome) held perfectly under real,
unscripted, fairly hostile network conditions — that part of Phase 8 is
unambiguously solid, independent of whether the feature turns out to be
worth enabling.
