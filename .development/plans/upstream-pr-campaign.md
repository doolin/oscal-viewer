# Upstream PR Campaign — EasyDynamics/oscal-viewer

Running log of PRs sent upstream. Each row should be quick to scan:
link, what it contains, status, and any technical lesson learned during
the send.

## Process

1. Branch off `upstream/main` (`contrib/<slug>`)
2. Cherry-pick or hand-write the relevant change
3. Strip fork-specific noise (e.g. `.development/` `.gitignore` entries,
   `.claude/` config, `.development/plans/` files)
4. Verify against upstream by running `npm install && npm test -- --run`
5. Push to `doolin/oscal-viewer` (`origin`, NOT `upstream`)
6. `gh pr create --repo EasyDynamics/oscal-viewer --base main --head doolin:<branch>`
7. Record in the table below

Before drafting tests for any target file, grep all local branches
and full history for prior test work against that file — the repo
already has >90% coverage and that work cost real money to produce.
Recover wholesale where it exists.

## PRs

| # | Branch | What | Status | Notes |
|---|---|---|---|---|
| [#64](https://github.com/EasyDynamics/oscal-viewer/pull/64) | `contrib/oscal-samples` | 7 NIST canonical OSCAL sample JSON files in `samples/` | **merged 2026-05-24** as `b1522a0` | Dropped `.gitignore` `.development/` ignore hunk. |
| [#65](https://github.com/EasyDynamics/oscal-viewer/pull/65) | `contrib/vitest-harness` | Vitest config + setup + 2 smoke tests + CI workflow + package.json deps | **merged 2026-05-24** as `efa13cb` | Dropped `.development/plans/test-coverage.md` (DU). Upstream rebased the branch and resolved the lockfile conflict. ~2 day latency. |
| [#68](https://github.com/EasyDynamics/oscal-viewer/pull/68) | `contrib/pure-helper-coverage` | 41 unit tests against 5 pure helpers + v8 coverage wiring | **merged 2026-05-28** as `628fb77a` | Dropped 4 strict-JWT-shape tests because upstream's `isValidJwtFormat` is now an alias for `isValidBearerTokenFormat` (RFC 6750 b64token). 8 files, +307/-1. |
| [#69](https://github.com/EasyDynamics/oscal-viewer/pull/69) | `contrib/azure-skip-fork-prs` | Conditional skip of Azure deploy job for fork PRs | **merged 2026-05-28** as `806f015a` | Only skips fork PRs (`pull_request.head.repo.full_name != github.repository`); org-internal PRs still deploy. 1 file, +7/-2. |
| [#70](https://github.com/EasyDynamics/oscal-viewer/pull/70) | `contrib/cookie-party-helper-coverage` | 18 tests against `partyDisplayName` + `sanitizedAnalyticsPath` + `viewerAnalyticsPath` | open 2026-05-24 (rebased 2026-05-28) | Rebased onto `806f015a` to pick up #69's fork-PR conditional; Azure check now skipped cleanly. 2 files, +122/-0. |
| [#71](https://github.com/EasyDynamics/oscal-viewer/pull/71) | `contrib/catalog-sort-index-coverage` | 14 unit tests for `useCatalogSortIndex` (sort-id index + comparator) including one explicit BUG lock-in for case-asymmetric lookup | open 2026-05-28 | Recovered from local PR #102 (port of upstream #57) at commit `21f84c6f`. Uses real `OscalProvider` + `Seed` helper, not `vi.mock`. 1 file, +293/-0. |

## Status — 2 PRs open, 4 merged (as of 2026-06-01)

Upstream HEAD is at `366e7d8e`. Two commits since #69 merged:
`d68bd86b` (depends-on relationship support) and `366e7d8e` (#72,
resizable sidebar).

## Candidate queue

1. **Coverage threshold in `vitest.config.ts`** — add a coverage floor
   (e.g. `coverage.thresholds.lines = 30`) so CI fails on regressions.
   Natural follow-up to #68's v8 coverage wiring.
2. **SspPage by-component crash fix** (Tier 1). Crash on `by-component`
   entries lacking `component-uuid`. Original line number (1807) is
   stale after upstream's 881-line rewrite of SspPage; re-verify the
   reproduction on current upstream HEAD before sending.
3. **Profile silent-drops** (Tier 1). `matching` patterns and
   `exclude-controls` ignored. Needs OSCAL spec citation in PR body.
4. **POA&M `threat-ids` not rendered** (Tier 1, smaller).

Recoverable coverage targets (only if prior local tests exist AND
target file has 1-2 commits in history AND the test encodes a useful
invariant):

- `src/hooks/useIsMobile.ts` (1 commit) — 22 lines
- `src/hooks/useAnalyticsView.ts` (1 commit) — 30 lines

## Lessons learned (running)

- **2026-05-22**: Strip fork-specific noise before cherry-picking
  to a contrib branch. `.gitignore` adding `.development/`,
  `.claude/` config, `.development/plans/` files.
- **2026-05-22**: PR title and commit message should match.
  `Co-Authored-By: Claude` stays in (provenance honesty).
- **2026-05-22**: `DU` conflict during cherry-pick usually means a
  fork-only file. `git rm <path>` resolves it cleanly.
- **2026-05-22**: After cherry-picking a test-related commit, run
  `npm ci && npm test` before push.
- **2026-05-24**: When upstream legitimately changes a function's
  contract (e.g. `isValidJwtFormat` → `isValidBearerTokenFormat`),
  drop the tests that asserted the old contract. Don't try to
  preserve them — the PR is "tests that pass on current upstream",
  not "tests that document fork history".
- **2026-05-24**: One-at-a-time rebase walk (`git rebase --onto NEW
  OLD`) repeated 21 times exposes the same intra-fork conflicts at
  every step. The "localize-by-upstream-commit" benefit is small;
  a one-shot `git rebase upstream/main` is probably fine and faster.
- **2026-05-24**: `npm install --package-lock-only` after
  `git checkout --theirs package-lock.json` does NOT install missing
  packages. Run a real `npm install` before tests after lockfile
  resolution.
- **2026-05-24**: Azure OIDC failures on fork PRs are GitHub
  security policy (no token for fork-triggered workflows), not
  workflow bugs. Conditional skip via
  `github.event.pull_request.head.repo.full_name == github.repository`
  is the right fix (PR #69).
- **2026-05-24**: Use `gh pr create --repo EasyDynamics/oscal-viewer
  --base main --head doolin:<branch>`. Bare `gh pr create` defaults
  wrong here.
- **2026-05-28**: When porting tests for an upstream file we
  previously covered locally, recover the prior test file from
  history rather than rewriting from scratch. The repo is already
  at >90% coverage and that work cost real money to produce.

## When upstream merges

After each merge:

1. Update the row to **merged** with the squash SHA.
2. If the merge changed anything (lockfile regen, file rename),
   note it in the row.
