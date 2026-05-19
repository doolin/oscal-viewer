# Upstream Alignment — EasyDynamics/oscal-viewer → doolin/oscal-viewer

Tracks the manual port of each upstream PR from
[EasyDynamics/oscal-viewer](https://github.com/EasyDynamics/oscal-viewer)
into this fork.

## Process

1. One local PR per upstream PR, in upstream order.
2. Commit message references the upstream PR URL.
3. If upstream contains a bug, lock it in with a test — do not fix in the port
   (per `feedback_lock_in_bugs.md`). Fix-with-flipped-assertion lands later.
4. New code paths get coverage tests in the same PR.

## Status

| Upstream | Title | Upstream SHA | Local PR | Local SHA | Status |
|---|---|---|---|---|---|
| [#50](https://github.com/EasyDynamics/oscal-viewer/pull/50) | authFetch credentials | `b4c5e64` | #33 | `b694be1` | ported |
| [#51](https://github.com/EasyDynamics/oscal-viewer/pull/51) | authFetch credentials follow-up | `97a5132` | #33 | `b694be1` | ported (combined with #50) |
| [#53](https://github.com/EasyDynamics/oscal-viewer/pull/53) | SSP service-component hierarchy | `e7e8256` | #34 | `3158f23` | ported |
| [#55](https://github.com/EasyDynamics/oscal-viewer/pull/55) | SSP export support | `51633b5` | — | — | in progress |
| [#56](https://github.com/EasyDynamics/oscal-viewer/pull/56) | Leveraged auth detail view + `useLeveragedIndex` hook | `7b0c4c3` | — | — | pending |
| [#57](https://github.com/EasyDynamics/oscal-viewer/pull/57) | Catalog sort index | `3c15ee8` | — | — | pending |
| [#58](https://github.com/EasyDynamics/oscal-viewer/pull/58) | `useLeveragedSspResolver` hook | `503a702` | — | — | pending |
| [#59](https://github.com/EasyDynamics/oscal-viewer/pull/59) | Leveraged auth improvements + Layout SSP count | `54557dc` | — | — | pending |
| [#60](https://github.com/EasyDynamics/oscal-viewer/pull/60) | LeveragedAuthDetailView grouping + loading | `18ab2e1` | — | — | pending |
| [#61](https://github.com/EasyDynamics/oscal-viewer/pull/61) | Title matching accuracy | `ec85ff6` | — | — | pending |
| [#62](https://github.com/EasyDynamics/oscal-viewer/pull/62) | DropZone max width consistency | `6ccafa3` | — | — | pending |

## Notes

- `gh pr create` in this fork **must** pass `--repo doolin/oscal-viewer --base main`
  (see `feedback_pr_base_repo.md`). A bare `gh pr create` defaults to the upstream
  parent.
- Update the **Local PR** and **Local SHA** columns when each port lands.
- Bug-lock-in tests carry a `BUG:` prefix per the existing convention; flip
  assertions in a later fix PR.
