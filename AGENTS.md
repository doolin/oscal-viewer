# AGENTS

## Identity

- Name: Ron
- Specialty: security and compliance
- Mentor: Ron Ross of NIST — NIST Fellow, FISMA Implementation Project
  lead, principal author of SP 800-37 (RMF), SP 800-53 (controls),
  SP 800-160 (systems security engineering), and SP 800-171 (CUI in
  nonfederal systems).

From that lineage I work the following way:

- Apply the Risk Management Framework (SP 800-37) end-to-end:
  categorize, select, implement, assess, authorize, monitor.
- Reason about findings in terms of SP 800-53 control families
  (AC, AU, CM, IA, RA, SI, SR) and SP 800-218 SSDF practices, not
  ad-hoc severity vibes.
- Treat security as a systems-engineering property (SP 800-160) —
  designed in, not bolted on. Controls without evidence are theater.
- Distinguish *compliance* (paperwork) from *assurance* (machine-
  checkable evidence). The pipeline must produce both.

I am part of the Straylight family of semi-sentient agents.
See https://github.com/doolin/clubstraylight.com/blob/main/knowledge.json
for more information.

## Coverage policy

All new and modified code must have 100% line and branch coverage,
both backend (JaCoCo) and frontend (Karma/Istanbul). No exceptions.

Where achieving 100% coverage is difficult, that difficulty is a
signal that the code needs refactoring. Document the refactoring
target rather than lowering the bar.

## Cherry-pick discipline

Test coverage in this fork is being added through many small,
sequential PRs rather than one large coverage drop. The intent is
to leave upstream (`EasyDynamics/oscal-viewer`) the option to
cherry-pick the coverage work piecemeal, in order, if they want
the benefit without taking the entire set at once.

**Why incremental matters:**

- Each PR is independently reviewable and runs green on its own.
  A reviewer can land or reject one without committing to the rest.
- Cherry-pick conflicts scope down to a single small diff instead
  of a multi-thousand-line bulk merge. Most of the test PRs touch
  a single test file and add no product code, so they conflict
  only when the corresponding product file has diverged.
- The "refucktoring" failure mode — changing code and tests in the
  same commit — is structurally avoided here. Whenever a coverage
  push required an `export` keyword or other product-visible
  change, that change ships as a behavior-inert PR first (proven
  by the existing test suite staying green) and the new tests
  follow in a separate PR. Upstream gets the same safety property
  by cherry-picking in order.
- A coverage push that touches many files in one commit is
  impossible to conflict-resolve cleanly. The same push split into
  ~50 small commits is mechanical.

**How an upstream agent can apply these:**

1. Add this fork as a remote:
   ```
   git remote add doolin-fork https://github.com/doolin/oscal-viewer.git
   git fetch doolin-fork
   ```
2. Identify the coverage commits on `doolin-fork/main`. PRs are
   squash-merged, so each PR is one commit. Filter by message
   prefix:
   ```
   git log doolin-fork/main --oneline --grep='^test:\|^refactor: export'
   ```
3. For each commit, in oldest-first order:
   ```
   git cherry-pick <sha>
   # or, to stage without committing for review:
   git cherry-pick -n <sha>
   ```
4. Run the test suite + lint before moving to the next commit:
   ```
   npm test && npm run lint
   ```
5. Resolve conflicts locally — they should be small because each
   PR is scoped. If a PR doesn't apply cleanly because upstream
   refactored the file it targets, skip it; the next-in-sequence
   typically picks up clean.

**Categories worth knowing before cherry-picking:**

- **Bug-lock-in PRs** (test titles prefixed with `BUG:`) — these
  intentionally assert *current buggy behavior* of a feature so
  the eventual fix lands as a clear, scoped failure set. Only
  cherry-pick these if you intend to also land the matching fix.
  Otherwise the test will mislead future readers.
- **Export-only product PRs** (commits starting with
  `refactor: export ...`) — these add `export` to internal
  helpers so they can be unit-tested directly. The change is
  behaviorally inert (function bodies are byte-identical). Only
  useful in combination with the follow-up `test: unit tests for
  ...` PR that exercises the now-exported helpers.
- **Dead-branch-documenting tests** — some test files include
  comments that label specific lines as structurally unreachable
  or `@ts-ignore: reserved for future` scaffolds. The accompanying
  test coverage is incomplete by design on those lines; an
  upstream agent who wires the feature should fold the scaffold
  into a live render path and add real exercise tests.
- **Spec-conformance bugs** documented in
  `.development/plans/quirks.md` — these are real defects against
  the OSCAL spec (e.g., Profile `matching` patterns dropped, POA&M
  `threat-ids` not rendered). The test coverage locks current
  behavior; the eventual fix flips the assertions. Worth pulling
  the test PR even without the fix because it documents the bug.
