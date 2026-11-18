# Fixtures

`healer-smoke-success.jsonl` is the real `claude -p ... --output-format
stream-json --verbose` output of the 2026-11-18 smoke run (Claude Code 2.1.318,
Playwright 1.65.1, one broken id-rename spec, healed in 5 turns). It is
trimmed, not edited: the long `slash_commands`/`skills`/`plugins`/
`capabilities`/`startup_timing` fields of the `init` event are removed, and the
local scratchpad and home paths are replaced by `<scratchpad>` and `<home>`.
Every parsed value (model, turns, cost, usage) is as the CLI printed it.

`trace-click-edit.trace` is the real `*-trace.trace` NDJSON from replaying the
final spec of `sibling-reorder.devices.row.dev-2.actionsOrder` run 1 against the
marked sibling-reorder build with `--trace on` (Playwright 1.65.1). It is trimmed
to the two `before` events (`click`, `expect`) and the two frame snapshots that
carry a `__playwright_target__` node; nothing is edited.
