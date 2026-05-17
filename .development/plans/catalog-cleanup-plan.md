# Catalog cleanup plan (post-export-arc)

**Pinned state — 2026-05-14**

Whole-repo branch coverage 91.57%. Per-page branches: AP 95.22% / PoaM 94.42% / Profile 93.74% / AR 91.03% / SSP 89.49% / CDef 87.50% / **Catalog 84.93% (96 uncovered branches)**.

The export-internal-helpers arc (PR #93/#94 CDef, #95/#96 Profile, #97/#98 Ssp) is done. PR #99 (v8-ignore three Catalog search guards) was opened then closed by user verdict: the framing was wrong. Defense at private internals is dead code, not defense — the right move is delete-or-test, not ignore.

## Framing the remaining work

The remaining Catalog branches are *not* a fourth instance of the export-helper pattern. They split into three categories that each need a different template:

### Category A — Dead defenses in private closures (delete candidates)

LLM-origin signature: guards in closures whose call sites already short-circuit on the same condition. The application never produces a state where these fire.

| File:Line | Helper | Guard | Decision |
|---|---|---|---|
| CatalogPage.tsx:552 | `controlMatches` | `if (!lowerSearch) return true` | Delete — caller L600 gated by `lowerSearch &&` |
| CatalogPage.tsx:562 | `groupHasMatch` | `if (!lowerSearch) return true` | Delete — caller L569 gated |
| CatalogPage.tsx:800 | `matchesSearch` (duplicate of `controlMatches`) | `if (!lowerSearch) return true` | Delete the whole function — same code as L551, used in MobileDrillDown only; either inline or thread the helper |

**Action for category A:** one cleanup PR that deletes the dead guards. If we want to dedupe `matchesSearch`/`controlMatches`, that's a separate refactor PR — but the user has not asked for that yet, so keep this PR small: delete guards only.

### Category B — Reachable-but-untested branches (test additions)

These are real application states the test fixtures don't currently exercise. Drive via maximalist + minimalist component fixtures, same pattern as parseSsp tests in #98.

**Highest yield clusters in CatalogPage.tsx:**

- **L1211, L1214** — MetadataView `meta.version ?? "—"` and `meta["oscal-version"] ?? "—"` falsy arms. Need a minimalist-metadata fixture rendered through MetadataView.
- **L1242, L1246** — props rendering: `p.class && (...)` and `p.ns && (...)` falsy arms. Need a prop with neither class nor ns.
- **L1263, L1264** — responsible-parties unknown-role and unknown-party-uuid fallbacks. Need a fixture with a role-id or party-uuid that doesn't resolve in the maps.
- **L1315, L1328** — party links: empty links array and link missing both text and rel (need `lnk.text ?? lnk.rel ?? lnk.href` to fall all the way through to href).
- **L680, L753, L762-766** — Mobile drill-down into a control (currently no test drills into a control on mobile). The "ctrl-" path in `getChildren` and `getControlChildren`'s `if (!ctrl) return []` arm.
- **L927-928** — ViewRouter `resource-` path when resource is *not* found (current test only covers found-resource).
- **L1411, L1581, L1698** — Larger view component conditional rendering (need to read 1393-1650 region first to scope).

**Action for category B:** one or more test-additions PRs that render CatalogPage with parameterized fixtures. Pattern:
1. Add a `MINIMAL_METADATA_CATALOG` fixture (title only, no version/oscal-version/parties/roles/props/links). Test renders MetadataView and asserts the `—` em-dash fallbacks appear.
2. Add a `RESPONSIBLE_PARTY_UNKNOWN_REFS` fixture (responsible-parties referencing role-ids and party-uuids that don't exist in roles/parties). Test asserts the fallback labels render.
3. Add mobile drill-into-control tests (existing mobile test only drills into a group).
4. Add resource-not-found navigation test (navigate to `resource-bogus-uuid`).

### Category C — JSX inline-render fallbacks (long tail)

Many `??` and `||` fallbacks scattered in view components (L1378-1480, L1537-1590, L1900-2050). Some are reachable via the minimalist fixtures above; others require specific edge fixtures. Diminishing returns past ~92% branches.

**Action for category C:** triage after Category B lands. Likely 1-2 more focused PRs for genuinely unreachable arms (delete) and the still-reachable ones (test). Target: get Catalog to 92%+ branches.

## Test code duplication (carried forward)

The user noted (correctly) that test code likely duplicates the source duplication. Specifically: `controlMatches` and `matchesSearch` are identical functions in two components, so any tests that exercise search-filter behavior likely have parallel test cases in `<CatalogPage /> loaded — desktop` and `<CatalogPage /> loaded — mobile` describe blocks. Worth a consolidation pass *after* the coverage push, not during.

## Order of operations

1. **PR — Catalog dead-guard delete** (Category A) — 3 lines removed. Closes 3 branches by reducing denominator. Verify no test regressions.
2. **PR — Catalog MetadataView minimalist tests** (Category B.1, B.2) — closes ~10-15 branches in L1180-1340 region.
3. **PR — Catalog mobile drill-down + ViewRouter tests** (Category B.3, B.4) — closes ~8-12 branches across the mobile and routing surface.
4. **Triage round** — re-run coverage, identify remaining hotspots, decide between delete vs test for the long tail.
5. **Then** the deferred items from earlier:
   - Bug-fix round (SspPage:1807, chain-resolver, ZIP rejection — flip the BUG: lock-in tests)
   - Test refactor + duplicate consolidation (test code mirroring source code)
   - Plant `coverage-baseline-2026-05-14` tag *after* bug fixes land

## Resistance/collaboration notes

User explicitly flagged that my resistance was growing during the Catalog push. Captured root causes in `feedback_resistance_signals.md`. Going forward:

- New template required (component-test fixtures), not the export-helper template. Commit to it.
- Per-PR yield will be smaller (+0.3-0.5 pp vs +1-2 pp on earlier pages). Accept it.
- Coverage substitutes for manual QA the user can't do. Don't bail on hard branches.
- When a "softer path" tempts (v8 ignore, refactor, "is this worth it?"), surface to user before acting.
