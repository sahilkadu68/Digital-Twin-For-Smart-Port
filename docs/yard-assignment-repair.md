# Canonical simulated yard repair and flight navigation — 18 October 2026

This supersedes the visual-only stack packing described in earlier reconstruction notes. The four-high rule is a chosen prototype constraint, not a statement about JNPA's actual operating limit. The geographic projection, terminal footprints, roads and traffic pipeline were not changed.

## One inventory, explicit corrections

All application pages still consume the same MongoDB records through the existing APIs/shared inventory store. No alternative container dataset was introduced. `src/data/yardAssignments.ts` supplies the migration's assignment policy and the renderer's read-only stack validation. Dashboard/analytics/report counts retain their existing definitions: 11,713 total records, 11,343 occupying records and 370 historical gate-out records. Backend services, reports and seed behavior are unchanged.

Dashboard, analytics and report screens do not expose an equipment-count metric; there was no such displayed count to compare. Equipment consistency was checked between the canonical `/equipment` response and all 30 unique rendered RTG placements. No new metrics UI was added.

`node scripts/repair-yard-assignments.cjs` is a dry run. `--apply` exports every collection as EJSON, records the complete plan, verifies that the inventory has not changed, then compare-and-set updates each original document. Each changed container keeps `assignmentCorrection.policy`, its original yard/block/row/column/level and the correction reason in MongoDB. Equipment corrections retain their original block and reason. These history fields are retained in MongoDB/backup; the existing API DTOs expose the corrected canonical fields, not the added history metadata.

The deterministic policy preserves terminal, yard and block. Within each horizontal slot it retains the most common compatible length (longer length breaks ties), orders by original level then stable ID, and compacts at most four records. Overflow and incompatible lengths go to the first compatible available slot within the **same block**, ordered by row/column. Standard and HC 40-foot containers may share a stack; cumulative actual heights are used. No cross-terminal/block reassignment is allowed. Uncertain provenance, invalid horizontal positions, insufficient capacity or unresolved stacks stop the migration for review. Gate-out assignments are historical and untouched. A broken stack encountered later is withheld from 3D with an unresolved count, never silently packed.

| Check | Before | After |
|---|---:|---:|
| Total containers / occupying / gate-out | 11,713 / 11,343 / 370 | unchanged |
| Occupied horizontal positions | 6,224 | 6,571 |
| Duplicate occupied-level groups | 1,409 | 0 |
| Stacks missing intermediate levels | 4,763 | 0 |
| Mixed-length stacks (40/40-HC count as one length) | 1,798 | 0 |
| Maximum records per horizontal position | 9 | 4 |
| Unresolved assignments after repair | — | 0 |
| Duplicate-number groups, identities retained for review | 304 | 304 |
| Equipment documents | 30 | 30 |
| Resolvable stored RTGs | 12 | 30 |

8,438 container assignments changed: 6,299 level-only corrections and 2,139 row/column changes within the original block. Changed records by terminal: NSICT 1,795; NSFT 1,032; NSIGT 818; APMT 1,182; BMCT 3,301; NSDT 310. IDs, container numbers, status, terminal/yard/block, cargo, dates and all other original fields were checked unchanged. Duplicate container numbers are not evidence that distinct MongoDB identities may be deleted; 304 groups remain for human identity review.

Successful backup: `backups/yard-four-high-2026-10-18T08-12-03-532Z/` contains `before.ejson`, `plan.json`, `updates.ejson`, `result.json`. A prior export at `backups/yard-four-high-2026-10-18T08-11-30-415Z/` contains `before.ejson` and `plan.json`; that attempt hit Windows' command-length limit **before any database write**. The successful implementation reads a local payload file instead. Preserve these exports; any rollback should review subsequent operational changes and restore only affected fields by ID, not blindly replace the database.

A second `--apply` run reported **0 container changes and 0 equipment changes**. No collection counts changed. Environment, terminals, vehicles and simulated traffic collection hashes remained identical. Original road SHA-256 remains `4f115d3293cc7dca3d702f142d8236e044d1106b56b0fef4479a8bdd7724fbcb`.

## RTGs and physical scale

`DataSeeder.seedEquipment` constructs legacy blocks from `terminal.substring(0, 2)`, explaining NS-01/02/03 in NSFT/NSICT/NSIGT. Stored terminal plus ordinal provides evidence for correcting those 18 simulated records to FT/IC/IG prefixes. Other associations were retained. There are six stored RTGs in each of NSFT, NSICT, NSIGT, APMT and BMCT; **NSDT has zero**. No equipment was invented or duplicated.

`equipmentPlacement.ts` labels each crane position `illustrative-within-stored-block`. Stable ID ordering gives multiple cranes separate travel positions along their stored block. Exact equipment coordinates are unavailable. Gantries have four legs, two overhead beams, bracing, cabin, trolley, hoist/spreader and eight instanced rubber tyres. Wheels meet the terminal surface; legs sit outside storage banks. The representative 18 m frame and 14 m spreader are illustrative dimensions, with over 2 m clearance above the tallest allowed four-HC stack. Navigation envelopes use the same placement helper and leave the portal open.

Official guidance consulted:

- [APM Terminals Mumbai — Our Terminal](https://www2.apmterminals.com/en/mumbai/about/our-terminal): describes GPS-assisted RTGs, including five/six-high capability and seven-wide stacking. This is local equipment context, **not** proof that our stored subset or illustrative dimensions correspond to real individual cranes.
- [Konecranes — Port of Houston RTG order](https://investors.konecranes.com/press/konecranes-wins-order-nine-more-rtgs-port-houston-authority-1736769): describes 16-wheel, one-over-five, six-wide plus truck-lane equipment. Supports the gantry/clearance concept; these are not JNPA specifications.

## Navigation and rendering

One existing OrbitControls instance still owns orbit/pan and smoothed wheel zoom. A focused, keyboard-accessible canvas adds W/S or arrows along the viewing direction, A/D or arrows for horizontal strafe, E/Q vertical, and 3× Shift. Combined directions normalize to one speed. Speed scales with eye clearance above terrain (3–1,200 m/s before boost). Eye and target translate together; the target may lie below ground during overhead forward travel. Only the eye requires clearance.

Movement is checked in steps no larger than 2 m against all canonical containers, even when filtered out, plus buildings, representative cranes/vessels and terrain. Blocked motion can slide on free axes, back away or rise. Keyup, canvas/window blur, document visibility and unmount clear movement. Inputs outside canvas focus retain normal typing/scroll behavior. Presets clear held flight state and preserve selection/status/terminal filters. Full Port remains the recovery action.

## Validation and limitations

- `npm run build`, `npm run lint` pass (existing large-chunk warning remains).
- `validate-port-spatial.cjs`: all 11,343 yard records, six terminals, four-high exact canonical tiers, cumulative heights, filter supports, 609 land samples, 376 bank corners, warehouse separation and road hash pass.
- `validate-yard-canonical.cjs`: actual API/report/terminal counts, 30 unique RTG placements, hoist clearance, damaged fixtures, idempotence, preserved fields and review guards pass.
- `validate-port-navigation.cjs`: actual component and native OrbitControls in a DOM harness; all held/released keys, overhead/oblique travel, normalized diagonals, Shift ratio, blur/visibility cleanup, terrain/container collision and escape, preset/mouse compatibility and listener cleanup pass.
- Existing API regression: 49 checks pass. Existing traffic regression: 28,946 checks pass; all three scenarios retain 2,893 features.
- Browser: inspected settled overview and all six terminal yards, restored RTGs in the five equipped terminals, NSDT's actual zero-equipment state, container selection showing canonical level four, status filters, presets and shared dashboard/analytics/report totals. Held/released W/S/A/D/E/Q, four arrows, W+D and Shift+W were exercised using timed native input; temporary DOM diagnostics confirmed movement and unchanged camera pose after each release, then were removed. Tab left viewport focus. Physical tab-switch while a key remained held and held right/middle mouse dragging were not automated; their cleanup/pan behavior is covered by the controls harness.

This remains a simulated visual model with schematic yard-slot geography and approximate infrastructure. No surveyed crane coordinates or real telemetry were added. Stack compatibility only enforces the chosen geometric/length constraint; hazardous segregation, reefer power, weights and real terminal operating rules still require an operational planner. Future reseeding would require rerunning the explicit migration; no automatic database repair runs on page load.

## Files changed

- `src/data/yardAssignments.ts`, `src/data/jnpa/equipmentPlacement.ts` (new shared policy/placement helpers).
- `src/data/jnpa/portSpatial.ts`, `src/utils/inventoryQuality.ts`, `src/hooks/useInventory.ts` (canonical validation and occupied-slot semantics).
- `src/pages/ContainerYard/DigitalTwinViewport.tsx`, `PortNavigation.tsx`, `navigationClearance.ts`, `components/PortAssets.tsx` (canonical rendering, flight, RTGs and clearance).
- `src/pages/Dashboard.tsx` (one explanatory sentence: schematic geometry remains unverified, rather than claiming corrected slot conflicts still exist).
- `scripts/repair-yard-assignments.cjs`, `scripts/validate-yard-canonical.cjs` (new); `scripts/validate-port-spatial.cjs`, `scripts/validate-port-navigation.cjs` (updated checks).
- `docs/yard-assignment-repair.md` (this report), `docs/3d-reconstruction.md` (supersession note); backup files listed above.

No backend source, seed logic, packages/configuration, 2D map, traffic code, original GeoJSON or inspection HTML was edited. Normal frontend build outputs were regenerated by the requested build.
