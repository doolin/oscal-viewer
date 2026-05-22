# Upstream PR Campaign — EasyDynamics/oscal-viewer

Running log of PRs sent upstream. Each row should be quick to scan: link,
what it contains, status, and any lesson learned during the send.

## Process

1. Branch off `upstream/main` (`contrib/<slug>`)
2. Cherry-pick or hand-write the relevant change
3. Strip fork-specific noise (e.g. `.development/` `.gitignore` entries,
   `.claude/` config, `.development/plans/` files)
4. Push to `doolin/oscal-viewer`
5. `gh pr create --repo EasyDynamics/oscal-viewer --base main --head doolin:<branch>`
6. Record in the table below

## PRs

| # | Branch | Origin commit (rebase-test) | What | Status | Notes |
|---|---|---|---|---|---|
| [#64](https://github.com/EasyDynamics/oscal-viewer/pull/64) | `contrib/oscal-samples` | `fe30ba9` (now `aca8e28`) | 7 NIST canonical OSCAL sample JSON files in `samples/` | open | Dropped the `.gitignore` `.development/` ignore hunk — fork-specific noise. |
| [#65](https://github.com/EasyDynamics/oscal-viewer/pull/65) | `contrib/vitest-harness` | `6b68251` (now `6fe7c38`) | Vitest config + setup + 2 smoke tests + CI workflow + package.json deps | open | Dropped the `.development/plans/test-coverage.md` modification (DU conflict — file doesn't exist upstream, was fork-only working notes). 7 files, +1412 / -58. Verified `npm ci && npm test` clean before push. |

## Status — blocked on PR #65

**2026-05-22**: All subsequent commits on `rebase-test` carry tests, so
they depend on the vitest harness from PR #65 landing first. Campaign
paused until #65 merges (or upstream's response gives direction). PR #64
can still merge independently — no downstream dependency on it.

## Candidate queue

Next candidates from `rebase-test`, ordered by how clean they are (least
intrusive first):

1. **`5b6f555` — docs: .development/plans notes** — fork-specific, skip
2. **`25abda9` — docs: plan for round 1 of test coverage** — fork-specific, skip
3. ~~**`6b68251` — test: stand up Vitest harness**~~ — sent as PR #65.
4. **`2e160fa` — test: coverage for pure helpers** — first concrete tests
   layered on the harness from PR #65. Likely depends on PR #65 merging
   first (otherwise the tests fail in CI). Hold until #65 merges or
   bundle into #65 as a follow-up.
5. Subsequent commits: page-by-page test backfill, hook extractions, the
   3 active arc lock-ins + 4 pre-arc lock-ins.

See `project_upstream_pr_campaign.md` in memory for the full strategy
(`tier 1 crashes` vs `tier 2 arc bugs`); use this file for the live PR
status that supersedes the memory snapshot.

## Lessons learned (running)

- **2026-05-22**: For each cherry-picked commit, check for fork-specific
  noise (`.gitignore` adding `.development/`, `.claude/` config,
  `.development/plans/` files). Strip via `git checkout HEAD~ -- <path>`
  before amending the cherry-pick, then update the commit message to
  drop the explanation. Keeps the PR tight.
- **2026-05-22**: PR title and commit message should match. The
  `Co-Authored-By: Claude` trailer stays in (per
  `feedback_keep_ai_credits.md`); credit honesty matters here too.
- **2026-05-22**: A cherry-pick with a `DU` conflict (deleted by us /
  modified by them) usually means the commit touched a fork-only file.
  `git rm <path>` is the correct resolution; the file should not exist
  upstream and you don't want to recreate it. Saw this on PR #65 with
  `.development/plans/test-coverage.md`.
- **2026-05-22**: After cherry-picking a test-related commit, run
  `npm ci && npm test` before push to confirm the harness actually
  works on the upstream base — local cache may hide a missing
  dependency that the freshly-installed lockfile would catch.

## When upstream merges

After each merge:
1. Mark the row as **merged** with the merge SHA
2. If the merge changed anything (squash, rebase), note in the row
3. The corresponding commit on `rebase-test` becomes redundant once we
   resync to the new `upstream/main`
