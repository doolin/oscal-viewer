# Upstream PR Campaign — EasyDynamics/oscal-viewer

Running log of PRs sent upstream. Each row should be quick to scan: link,
what it contains, status, and any lesson learned during the send.

## Strategic frame (updated 2026-05-24)

The campaign is now framed as an **influence-behavior experiment** with
a **15-20 PR threshold** for real evidence of behavior change in
`pjavan` (the active upstream collaborator). The asymmetric value
reality is acknowledged: pjavan is doing public, risky OSCAL adoption
advocacy; we are doing quiet engineering. Two different roles.

See `feedback_upstream_influence_experiment.md` in memory for the full
frame and signal-tracking criteria.

**Implication for future PRs:** prefer Tier 1 bug fixes (real user
crashes, semantic spec violations) and *mechanism* PRs (CI gates that
enforce discipline) over coverage-expansion PRs. Coverage on our fork
stays local unless the target file is genuinely low-churn AND the test
encodes a useful invariant.

## Process

1. Branch off `upstream/main` (`contrib/<slug>`)
2. Cherry-pick or hand-write the relevant change
3. Strip fork-specific noise (e.g. `.development/` `.gitignore` entries,
   `.claude/` config, `.development/plans/` files)
4. Verify against upstream by running `npm install && npm test -- --run`
5. Push to `doolin/oscal-viewer` (`origin`, NOT `upstream`)
6. `gh pr create --repo EasyDynamics/oscal-viewer --base main --head doolin:<branch>`
7. Record in the table below

## PRs

| # | Branch | What | Status | Notes |
|---|---|---|---|---|
| [#64](https://github.com/EasyDynamics/oscal-viewer/pull/64) | `contrib/oscal-samples` | 7 NIST canonical OSCAL sample JSON files in `samples/` | **merged 2026-05-24** as `b1522a0` | Dropped `.gitignore` `.development/` ignore hunk. Approved by `pjavan` after local build. |
| [#65](https://github.com/EasyDynamics/oscal-viewer/pull/65) | `contrib/vitest-harness` | Vitest config + setup + 2 smoke tests + CI workflow + package.json deps | **merged 2026-05-24** as `efa13cb` | Dropped `.development/plans/test-coverage.md` (DU). pjavan rebased the PR himself, resolved lockfile conflict against new upstream/main, validated, merged. ~2 day latency. |
| [#68](https://github.com/EasyDynamics/oscal-viewer/pull/68) | `contrib/pure-helper-coverage` | 41 unit tests against 5 pure helpers + v8 coverage wiring | **merged 2026-05-28** as `628fb77a` | Silent merge by pjavan. No review, no comment, no question. Extraction signal. |
| [#69](https://github.com/EasyDynamics/oscal-viewer/pull/69) | `contrib/azure-skip-fork-prs` | Conditional skip of Azure deploy job for fork PRs | **merged 2026-05-28** as `806f015a` | Approved by `pkothare` (org MEMBER, new actor in the loop), merged by pjavan. No comments. Possibly-positive: a second human reviewer engaged. |
| [#70](https://github.com/EasyDynamics/oscal-viewer/pull/70) | `contrib/cookie-party-helper-coverage` | 18 tests against `partyDisplayName` + `sanitizedAnalyticsPath` + `viewerAnalyticsPath` | open 2026-05-24 | Targets low-churn helpers. Independent from #68. 2 files, +122/-0. |

## Status — 1 PR open, 2 merged silently

**2026-05-28**: #68 and #69 merged in a single batch (22:21 / 22:45
UTC) by `pjavan`. #70 still open. Upstream HEAD is now at `806f015a`
(our #69). Between session end and merge batch, only one new upstream
commit shipped: `8fdd78fb` (testless `feat:` for StatusBadge styling).

**Tally so far (PRs 1-4 of the 15-20 window):**

| PR | Substantive Q? | Comment beyond merge? | Tests on his own new feat? | Referenced our PR? |
|---|---|---|---|---|
| #64 | No | No | n/a (pre-harness) | No |
| #65 | Implicitly (lockfile rebase) | No | No | No |
| #68 | No | No | No (`8fdd78fb` testless) | No |
| #69 | No (pkothare APPROVED, no body) | No | No | No |

**New observation:** `pkothare` (org MEMBER) reviewed #69. First
non-pjavan human in the loop. Could be routine merge-enablement or a
genuine second pair of eyes — too early to read.

## Behavior signals to record on restart

Per `feedback_upstream_influence_experiment.md`:

For each merged PR, record:

- **Substantive question asked?** Yes / No (one-line summary)
- **Comment beyond "thanks, merged"?** Yes / No
- **Has pjavan written a test on any new feature he authored since #65?** Yes / No
- **Has he referenced one of our PRs in a related commit message?** Yes / No

Tally over the 15-20 PR window will determine whether the campaign
continues past PR ~15.

## Candidate queue (under new strategic frame)

Coverage-expansion candidates are deprioritized. Higher-priority:

1. **SspPage by-component crash fix** (Tier 1). Crash on `by-component`
   entries lacking `component-uuid`. Original line number (1807) is
   stale after upstream's 881-line rewrite of SspPage in `a85be09`;
   re-verify the reproduction on current upstream HEAD before sending.
2. **Coverage threshold in vitest.config.ts** (mechanism PR).
   Add `coverage.thresholds.lines = 30` (or similar) so PRs that drop
   coverage below floor fail CI. This is the *only* path to pjavan
   writing tests on his own future code — mechanism, not persuasion.
   See influence-experiment memory.
3. **Profile silent-drops** (Tier 1). `matching` patterns and
   `exclude-controls` ignored. Needs OSCAL spec citation in PR body.
4. **POA&M `threat-ids` not rendered** (Tier 1, smaller).

Still-acceptable coverage candidates (only if target file has 1-2
commits in history AND test encodes a useful invariant):

- `src/hooks/useIsMobile.ts` (1 commit) — 22 lines, low test surface
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
  wrong here (memory: `feedback_pr_base_repo.md`).

## When upstream merges

After each merge:

1. Update the row to **merged** with the squash SHA.
2. Apply the behavior-signal calibration: did pjavan engage
   substantively or just merge silently?
3. If the merge changed anything (lockfile regen, file rename),
   note it in the row.
