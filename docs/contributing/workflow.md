# Workflow

## Branches

`main` is protected. All changes arrive through pull requests. Use short-lived branches
named after the change type, for example `feat/config-loader`, `fix/resume-state`,
`docs/testing-guide`.

## Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org) and
are checked by commitlint in the `commit-msg` hook:

```text
feat: add reviewer verdict schema
fix(git): keep untracked files when reverting guardrail changes
docs: explain mutation testing
chore(deps): bump vitest
```

Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`. Commits on a
branch can be small; pull requests are squash-merged, so the PR title becomes the commit
on `main` and must follow the same format.

## Pull requests

1. Make sure `bun run verify` passes locally.
2. Open a pull request. Describe what changed and why. Link the issue if there is one.
3. CI runs:

   | Check        | When                        | Blocks merge                                   |
   | ------------ | --------------------------- | ---------------------------------------------- |
   | `verify`     | every PR and push to `main` | yes                                            |
   | `guardrails` | every PR                    | yes                                            |
   | `mutation`   | PRs that change `src/`      | not required, but must be green before merging |

4. Keep a pull request focused on one thing. **Guardrail changes always go into their
   own pull request** (see [guardrails](guardrails.md#changing-a-guardrail)).
5. Squash-merge. The branch is deleted automatically.

## Definition of done

- `bun run verify` passes.
- New behavior is covered by tests that would fail without it (mutation testing tells
  you whether they really do).
- Documentation is updated: human docs in `docs/`, agent rules in `AGENTS.md` if a rule
  changed.
- Architectural decisions are recorded as an ADR in `docs/adr/` (copy
  `0000-template.md`).
- The plan checklist in `docs/PLAN.md` is updated when a plan item is completed.
