# Testing

## Layout

Tests live next to the code they test:

```text
src/core/config/load.ts
src/core/config/load.test.ts
```

Every source file needs a sibling test file, except `index.ts` (wiring only) and
`*.types.ts` (types only). `test/` holds shared helpers:

```text
test/fakes/   in-memory implementations of core ports
test/e2e/     end-to-end tests against a sample repository (phase 5)
```

## Running tests

| Command              | Purpose                            |
| -------------------- | ---------------------------------- |
| `bun run test`       | All tests with coverage (as in CI) |
| `bun run test:watch` | Watch mode while developing        |
| `bun run mutation`   | Mutation testing (slow, see below) |

Tests run on Node.js through Vitest, not with `bun test`.

## Writing good tests

- **Test behavior, not implementation.** Call the public function and assert on its
  result or on the calls it made to a port. Do not assert on private helpers.
- **Prefer fakes over mocks.** For core code, use the fakes from `test/fakes/` (for
  example a fake `Vcs` that records commits in memory). Fakes stay valid when internals
  change; `vi.mock` setups often do not.
- **Assert precisely.** `toEqual` on the whole result is better than checking a single
  field. Mutation testing will point out assertions that are too weak.
- **One scenario per test**, named as a sentence: `it("reverts coder changes to tester
files")`.
- **Table tests** with `it.each` for variations of the same behavior.
- **No `.only`, no `.skip`**, and every test must contain an assertion (enforced).
- **Deterministic:** no real time, randomness or network in unit tests. Use the
  `Clock` port and fakes.
- **Adapters** are tested against real but local resources where cheap (temporary git
  repositories, a local HTTP server) and never against real AI models or GitHub.

## Coverage

Thresholds: 90 % for `src/core/**`, 80 % elsewhere (lines, branches, functions,
statements). `bun run test` prints a table and fails below the thresholds. An HTML
report is written to `coverage/index.html`.

Uncovered branches usually mean a missing test case. If a branch is truly unreachable,
remove it instead of testing around it.

## Mutation testing

Coverage tells you which code ran. Mutation testing tells you whether your tests would
notice if it were wrong.

[Stryker](https://stryker-mutator.io) makes small changes to the source code — flips
`>` to `>=`, replaces a condition with `true`, empties a function body — and runs the
tests for each change (a _mutant_):

| Result        | Meaning                                                |
| ------------- | ------------------------------------------------------ |
| Killed        | A test failed. Good.                                   |
| Survived      | No test failed. The tests miss this behavior.          |
| No coverage   | No test even runs this code.                           |
| Timeout       | The mutant caused an infinite loop; counted as killed. |
| Compile error | The mutant does not type-check; ignored.               |

The mutation score (killed / valid mutants) must be at least 80.

```bash
bun run mutation
# open reports/mutation/mutation.html
```

Stryker runs incrementally and only re-tests what changed since the last run. Use
`bun run mutation --force` for a full run. In CI it runs on pull requests that change
`src/` and nightly; the report is uploaded as the `mutation-report` artifact.

### Fixing surviving mutants

1. Open the report and find the surviving mutant. It shows the original and mutated
   code.
2. Ask: what observable behavior differs between the two? Write a test that asserts
   exactly that.
3. If no observable behavior differs, the code is redundant — simplify it.

Example: if changing `iteration >= max` to `iteration > max` survives, there is no test
for the boundary where `iteration` equals `max`.
