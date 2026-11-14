# AGENTS.md

Instructions for any AI agent working in this repository.

1. Read [`CLAUDE.md`](CLAUDE.md) first. It is the binding working agreement
   for every agent here, whatever its vendor. Where anything below or in
   `skills/` differs from it, `CLAUDE.md` wins.
2. Then load the skill that matches the task. Each is a `SKILL.md` with a
   `references/` folder; read the references only when the task needs them.

| Task                                                                                                                              | Skill                                                                |
| --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Change code, tests, docs, or CI here; run the test suites; open a pull request; record something in `NOTES.md`; prepare a release | [`skills/eir-development/SKILL.md`](skills/eir-development/SKILL.md) |
| Run the mutation benchmark, read its results, run the demo, produce a dogfood PR comment                                          | [`skills/eir-benchmark/SKILL.md`](skills/eir-benchmark/SKILL.md)     |
| Use `playwright-eir` in a Playwright project; read an `eir-report.json`; apply a suggested selector; understand the `.eir/` store | [`skills/playwright-eir/SKILL.md`](skills/playwright-eir/SKILL.md)   |

The rules agents most often break here:

- Never push to `main`. Every change goes through a pull request.
- Never merge, tag, publish, force-push, or delete a branch without the owner
  asking for that specific action.
- Never state a measured number you did not get from a run or a committed
  report.
- `pnpm --filter demo-app e2e` and `pnpm bench` rewrite committed files. Check
  `git status` after running them.
