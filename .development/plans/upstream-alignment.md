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
| [#55](https://github.com/EasyDynamics/oscal-viewer/pull/55) | SSP export support | `51633b5` | [#100](https://github.com/doolin/oscal-viewer/pull/100) | `4ddfe8c` | ported |
| [#56](https://github.com/EasyDynamics/oscal-viewer/pull/56) | Leveraged auth detail view + `useLeveragedIndex` hook | `7b0c4c3` | [#101](https://github.com/doolin/oscal-viewer/pull/101) | `12be58d` | ported |
| [#57](https://github.com/EasyDynamics/oscal-viewer/pull/57) | Catalog sort index | `3c15ee8` | [#102](https://github.com/doolin/oscal-viewer/pull/102) | `8fa81e6` | ported |
| [#58](https://github.com/EasyDynamics/oscal-viewer/pull/58) | `useLeveragedSspResolver` hook | `503a702` | [#103](https://github.com/doolin/oscal-viewer/pull/103) | `804e552` | ported |
| [#59](https://github.com/EasyDynamics/oscal-viewer/pull/59) | Leveraged auth improvements + Layout SSP count | `54557dc` | [#104](https://github.com/doolin/oscal-viewer/pull/104) | `d8fa39c` | ported |
| [#60](https://github.com/EasyDynamics/oscal-viewer/pull/60) | LeveragedAuthDetailView grouping + loading | `18ab2e1` | [#105](https://github.com/doolin/oscal-viewer/pull/105) | `32e4066` | ported |
| [#61](https://github.com/EasyDynamics/oscal-viewer/pull/61) | Title matching accuracy | `ec85ff6` | [#106](https://github.com/doolin/oscal-viewer/pull/106) | `62d8ec4` | ported |
| [#62](https://github.com/EasyDynamics/oscal-viewer/pull/62) | DropZone max width consistency | `6ccafa3` | [#107](https://github.com/doolin/oscal-viewer/pull/107) | `6b85f5c` | ported |

## Notes

- `gh pr create` in this fork **must** pass `--repo doolin/oscal-viewer --base main`
  (see `feedback_pr_base_repo.md`). A bare `gh pr create` defaults to the upstream
  parent.
- Update the **Local PR** and **Local SHA** columns when each port lands.
- Bug-lock-in tests carry a `BUG:` prefix per the existing convention; flip
  assertions in a later fix PR.

## Arc complete — 2026-05-19

All 8 upstream PRs ported. Active bug lock-ins (held for the bug-fix round
that follows the coverage push):

| Lock-in | Where | What it asserts |
|---|---|---|
| #57 case-asymmetric sort-id | `useCatalogSortIndex.test.tsx` | Walker stores ID case-as-found; comparator tries lowercase + raw, never uppercase. Catalogs storing uppercase IDs with lowercase lookups miss the sort-id and fall through to raw-string compare. One-line fix: normalize keys to lowercase in `buildSortMap`. |
| #58 fileName-skip gap | `useLeveragedSspResolver.test.tsx` | `initiallyLoaded` is built from `sourceUrl` + `fileName` but the visited check is URL-keyed only. A previously-uploaded provider file does NOT dedup against a later auto-fetch of the same `.json` URL. One-line fix: also check `fileNameFromUrl(url)`. |
| #60 cache never clears | `useChainResolver.test.ts` | `completedChainAttempts` is module-scoped and never pruned. After `clearSsp` + same-URL reload, the chain refuses to re-run. Fix options: instance-scope via `useRef`, or expose `clearChainCache()` that `OscalProvider` calls from `clearSsp` / `addLeveragedSsp`. |

Pre-arc lock-ins still pending fix-rounds: Profile `matching` patterns
silently dropped; Profile `exclude-controls` silently ignored; POA&M
`threat-ids` not rendered; SspPage:1807 crash on `by-component` lacking
`component-uuid`.

The #56 BUG (empty leveraged-auth title matches every provider) was
flipped to its fixed assertion when #58 ported (not #61 as initially
predicted — the new `titleMatches` in #58 is what fixed it).
