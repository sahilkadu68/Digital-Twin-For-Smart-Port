# JNPA 3D reconstruction — evidence and validation

Current stack/navigation behavior is documented in [yard-assignment-repair.md](yard-assignment-repair.md). Its canonical, backed-up four-high repair supersedes the earlier visual-only packing/max-nine display described below; keyboard free flight and all 30 stored RTGs are now supported. Earlier sections remain a record of prior reconstruction stages.

## Scope and previous distortion

The previous scene combined arbitrary terminal offsets and rotations, fixed block sizes, unrelated ground/road coordinates and camera targets that did not account for the full footprint. BMCT was placed separately. Scene units, container proportions and yard spacing were inconsistent. Adding containers would not resolve these spatial problems.

The replacement is a map-derived visual model, not a surveyed or engineering-accurate twin. All six application identifiers remain: NSFT, NSICT, NSIGT, APMT, BMCT and NSDT. APMT is the existing application identifier for Gateway Terminals India. NSDT keeps its inventory identity; its association with the shallow/distribution area is approximate.

## Spatial evidence and units

- Local `docs/reference/JNPA_2026_LULC.pdf`, page 1: registered physical shoreline, terminal areas, hill, industrial and circulation context. Approximate physical outlines were traced from the rendered map, not from the positions of text labels.
- Local 2022 land-use report, PDF page 236: supporting visual evidence for broad rail/circulation relationships. Proposed connections are not treated as existing surveyed roads.
- 2026 PDF page size: 2383.93 × 1683.78 points; viewport bbox `[96.7367,122.69,2300.45,1571.38]`; local registration points `[0,0,0,1,1,1,1,0]`; geographic corners span longitude 72.9234–73.0492 and latitude 18.885–18.9677, WGS84. The source trace image was 1888 × 1334 pixels.
- `mapPoint` converts image pixels to PDF coordinates (including vertical inversion), then uses that registered viewport to obtain longitude/latitude. `projectGeo` uses a common local east/south frame, one unit per metre: east = Δlongitude × 111320 × cos(18.94°), south = −Δlatitude × 111320. The origin (72.975,18.94) is only a numerical reference, not an asserted landmark or port centre. This local approximation is not a survey projection.
- Yard footprints, yard-frame depths, coastline detail, relief, structures and infrastructure positions remain estimates. Published berth length constrains length, not an independently verified terminal width or exact endpoint.

Published quay/berth dimensions used:

| Application ID | Length (m) | Evidence and limitation |
| --- | ---: | --- |
| NSFT | 680 | JNPA terminal publication; map placement approximate |
| NSICT | 600 | JNPA terminal publication; map placement approximate |
| NSIGT | 330 | JNPA terminal publication; yard and quay are distinct areas |
| APMT | 712 | JNPA and APM Terminals; GTI identity retained |
| BMCT | 2000 | PSA September 2025 Phase 2 publication; replaces historical Phase 1's 1000 m context |
| NSDT | 445 | JNPA combined shallow-water berth dimension; association with this inventory view and endpoints approximate |

Primary sources:

- [JNPA terminal descriptions](https://www.jnport.gov.in/page/terminals/VDRTUFJlSzllbDRDY05hVzdmdG5KZz09)
- [APM Terminals Mumbai — terminal](https://www2.apmterminals.com/en/mumbai/about/our-terminal)
- [PSA Phase 2 inauguration, September 2025](https://www.globalpsa.com/psa-inaugurates-phase-2-of-psa-mumbai-indias-largest-container-terminal/)
- [PSA India terminal information](https://india.globalpsa.com/landing/)
- [JNPA administration report 2023–24](https://www.jnport.gov.in/uploads/content_manager/Administration%20Report%202023-2024.pdf)
- [Sagarmala JNPT master plan](https://sagarmala.gov.in/sites/default/files/4.Final%20Master%20Plan_JNPT.pdf) — historical layout context, not proof of current occupancy.

No competition recording was found in the accessible project/reference assets or searched attachments. No claim is made to have inspected that recording.

## Rendering and interaction

The six terminals share one geographic frame and continuous approximate coastal land. Metric storage banks, lanes, quay aprons, fenders, lights and representative workshops make the yards legible. Shared instanced boxes build cranes and repeated structures; inventory containers use one native instanced mesh per terminal. Tanks and vegetation are instanced. Roads use original GeoJSON coordinates through the same projection and the existing inspection display-scope helper; merged road surfaces do not alter the source export. Rail corridors are approximate traces, with illustrative track count and spacing.

Containers retain their original IDs, terminal/block relationships, row, column and level. The renderer projects logical slots into approximate yard frames; it does not claim surveyed operational positions. Physical lengths are 6.058/12.192/13.716 m for 20/40/45 ft containers, width 2.438 m, height 2.591 or 2.896 m. Conflicting slots remain coincident; unsupported stored stack levels are not silently repaired.

STS repetitions (including 16 at BMCT), three vessel models, workshops, roof panels and tank details are illustrative architecture, not reported equipment counts, telemetry or berth occupancy. Stored RTGs appear only where the existing terminal/block join resolves. Invalid NS-prefix equipment joins are not relocated to invented positions. The infrastructure checkbox and model notes make this distinction explicit.

Camera fitting uses the actual footprint and quay vertices. Overview, selected terminal, yard detail, selected container, damping, clamped zoom and orbit buttons share the same scene. All terminal infrastructure remains present when operational filters change. Selection details and read-only crane-accessibility feedback remain available.

## Changed files

1. `src/data/jnpa/portSpatial.ts` — registration, common metric frame, approximate footprints, slot projection.
2. `src/data/jnpaLayout.ts` — compatibility exports for the spatial model.
3. `src/pages/ContainerYard/DigitalTwinViewport.tsx` — instanced inventory, cameras, lighting and scene controls.
4. `src/pages/ContainerYard/components/Terminal3D.tsx` — terminal ground, banks, circulation and quay architecture.
5. `src/pages/ContainerYard/components/PortAssets.tsx` — reusable procedural structures, vessels and stored RTGs.
6. `src/pages/ContainerYard/components/PortEnvironment.tsx` — water, approximate coastal terrain, roads, rail, vegetation and industrial context.
7. `src/pages/ContainerYard/portMeshes.ts` — shared geometry builders.
8. `scripts/validate-port-spatial.cjs` — read-only spatial and inventory projection validation.
9. `docs/3d-reconstruction.md` — this evidence/validation record.

No backend, traffic pipeline, package, configuration or original road-data source was edited for this reconstruction. Build output is generated by the normal build command.

## Verified results

- `npm run build`: passed; Vite reports its bundle-size warning (main chunk approximately 2.36 MB).
- `npm run lint`: passed with zero warnings.
- `node scripts/validate-port-spatial.cjs`: passed against the existing API. All six IDs, 376 bank corners inside approximate footprints, contiguous northern quay sections, configured metric quay lengths, physical container proportions and unchanged inventory tuples checked. Eligible yard records: 11,343 — NSICT 2443, NSIGT 1104, APMT 1606, BMCT 4414, NSFT 1369, NSDT 407.
- Existing traffic validation, with `VALIDATION_API_BASE=http://localhost:8081/api/v1`: passed 28,946 checks, 2,893 records in each of three scenarios. An initial attempt used the stopped temporary port 8082 and failed to connect; rerunning against the existing backend passed.
- Actual browser inspection: full-port overview with all six labels, BMCT fit/detail, orbit/zoom buttons, BMCT Import count 1494, full-port Import count 3768, restoration to 11,343 records, and clicking a native container to open MAEU1224379 at BMCT/BM-33/row 5/column 9/level 2. Full port was accessible while the details panel remained open. Earlier selection also verified ONEY8105143. No hardware FPS benchmark is claimed.
- Original road export remains 2,893 features, 2,551,535 bytes; SHA-256 `4f115d3293cc7dca3d702f142d8236e044d1106b56b0fef4479a8bdd7724fbcb`.
- Read-only collection hashes recorded before and after the reconstruction matched for containers, terminals, equipment, environment readings, vehicles and simulated traffic. No database writes or reseeding were performed by this task.

Remaining limits: coarse map outlines can leave context roads beyond the approximate land surface; there is no surveyed gate placement, bathymetry, detailed coastline or authoritative per-container position. Existing duplicate numbers, slot conflicts and incomplete equipment joins are preserved. Published dimensions and map traces constrain a presentation model, not an engineering reconstruction. The normal development servers currently running were reused for the final checks; no additional validation servers were left running.

## Focused coastal/navigation correction — 18 October 2026

The follow-up checks did **not** reproduce container-bank coordinates outside BMCT's land. The more specific rendering defect was poor depth precision: a 1 m camera near plane across a 60 km clipping range, with only 2 m between water and land. Overview banding/overlap disappeared in the browser after changing the clipping range to 20–40,000 m. No individual containers or terminal transforms were moved.

BMCT's terminal and coastal mesh now share the same existing registered-map coastal vertices, including the rear reclamation edge, instead of maintaining separate approximations. The land has a solid 5 m skirt terminating below the water plane; this is illustrative construction thickness, not measured elevation or bathymetry. Quay alignment, 2,000 m quay length and the five other terminal placements are unchanged. Rail and original road coordinates were not altered.

`PortNavigation.tsx` now owns both native three-stdlib MapControls and the frame update, replacing the competing Drei update/preset writer and global navigation events. Orbit/pan have time-adjusted damping. Wheel radius converges smoothly with normalized, capped input. Presets and buttons share a 0.95 s eased spherical transition, using the shortest azimuth arc and moving the target with the view. Pointer input interrupts the transition at its current pose. Residual orbit/pan momentum is drained without changing the current pose before a new preset. Listeners are installed once per controls instance and removed on cleanup, including resize-independent wheel handling.

Distance is clamped to 280–18,000 m, polar angle to 0.23–1.15 radians, with an eye-height guard at 110 m above the model datum. This deliberately limits very low close-ups to keep the camera above modeled structures; it is not a general mesh collision solver. Full Port changes the view without clearing the selected terminal, status filter or selected container. Selection camera anchors use the unfiltered inventory so changing a filter does not cause an unwanted later refocus.

Files changed in this follow-up:

- `src/data/jnpa/portSpatial.ts`
- `src/pages/ContainerYard/portMeshes.ts`
- `src/pages/ContainerYard/components/PortEnvironment.tsx`
- `src/pages/ContainerYard/DigitalTwinViewport.tsx`
- `src/pages/ContainerYard/PortNavigation.tsx` (new)
- `scripts/validate-port-spatial.cjs`
- `scripts/validate-port-navigation.cjs` (new)
- `docs/3d-reconstruction.md`

Validation:

- Build and lint pass. The existing bundle-size warning remains.
- Spatial checks cover 609 samples along all six footprint edges and 376 bank corners against the actual triangulated land surface, plus the same 11,343 inventory projections and source hash.
- The navigation regression harness executes the actual component with real MapControls and an in-memory DOM. It checks overview frustum inclusion for all six footprints/quays, presets, selection retention, repeated zoom/rotation, wheel smoothing and both distance limits, eye clearance, native pan translating camera/target together, native right-drag orbit, settling without drift, interruption and listener cleanup. These are functional checks, not an FPS benchmark.
- Browser review covered the full-port overview, BMCT fit/detail, NSICT fit, repeated pan/wheel input and orbit/zoom buttons, and the Full Port / Fit Terminal / Yard Detail sequence. NSICT Import remained at 801 records after Full Port. Clicking HLCU4799419 opened BMCT / BM-21 / row 6 / column 5 / level 4; Full Port retained its detail panel. No browser console errors were reported during this review.
- The original GeoJSON SHA-256 and all six recorded MongoDB collection hashes still match the prior record. No database, backend, traffic pipeline, 2D map, packages or configuration were changed.

Remaining QA limits: broad coastline/rail traces remain approximate, and some source roads extend beyond the modeled coastal context, appearing over water. There is insufficient surveyed shoreline evidence to correct those automatically. Conflicting or unsupported stored stacks remain visible rather than changing inventory assignments. The reviewed overview and terminal labels are legible at desktop size; no hardware performance benchmark or touch-device validation was performed.

## Grounded stacks and free mouse navigation — 18 October 2026

This section supersedes the earlier fixed-height/coincident-stack rendering and the restrictive 280 m / 110 m navigation limits. The supplied `C:/Users/Sahil/Downloads/20261017-1549-01.1205729.mp4` was decoded locally with existing OpenCV. Keyframes across its 25.93 seconds were inspected as a navigation/presentation reference; its fictional environment was not substituted for JNPA.

Actual geometry causes:

- Bank slabs had an air gap beneath them. Their top was 1.125 m, but container bottoms started at 1.2 m: another 75 mm gap.
- Tier spacing was always 2.95 m, although actual heights are 2.591 m or 2.896 m. This created gaps even in complete stacks and did not accumulate mixed heights correctly.
- The eligible inventory has 6,224 occupied horizontal slots: 4,763 lack one or more stored support levels and 1,409 contain duplicate stored levels. Some stacks mix lengths. Those records cannot establish a verified physical arrangement.

All bank slabs now span the terminal surface at 0.45 m to their common top at 0.65 m; lane slabs and paint meet their surfaces. Container bottoms and tops accumulate exact physical heights. All 11,343 eligible records retain their original IDs, terminal, yard, block, row, column and stored level.

**Explicit display policy:** within each existing horizontal slot, the model packs existing boxes into contiguous display tiers. Longer boxes are below shorter ones; ties use stored level and stable ID. This avoids interpenetrating duplicate boxes and unsupported overhangs without randomly moving records or creating support records. It is an illustrative visual order, not a correction of stored levels or an operational assignment. The map header, selected-record badge and notes distinguish display tier from stored level. Of the 6,224 stacks, 5,224 need this qualification; the largest contains nine existing records. The stored maximum level remains unchanged.

The layout is built from the complete eligible inventory before filters. When a visible box's real lower records are filtered out, only those lower records remain as non-selectable muted support context, excluded from the filtered count. Matching boxes do not move when filters change. Full-port Import uses 1,501 such real lower records. No dummy containers or invisible repaired database positions are introduced.

Related visual corrections: rear warehouse depth/position now fits the unused margin beyond the final bank; building bases rest on the terminal surface; representative vessel stacks use exact touching tier heights. Existing RTG geometry clears the displayed stack envelope and its feet meet the ground. Close views show only the relevant terminal label; overview retains all six labels. No terminal footprint, road geometry or coastline was moved in this pass.

Navigation now uses one native OrbitControls instance: left orbit, right screen-space horizontal/vertical pan, middle pan, wheel/two-finger-scroll zoom, and retained native pinch handling. A captured wheel handler owns wheel dolly exclusively. Small deltas, delta modes and Ctrl-wheel pinch input are normalized; reversal resets pending direction immediately and bounded pending distance prevents excessive accumulated inertia. Orbit/pan damping is faster, and pointer release drains momentum without changing the current pose. A drag-distance capture guard plus the mesh click guard prevents drag-end selection/refocus.

The minimum distance is now 8 m, maximum 18 km, with near-overhead to low-oblique polar angles. Adaptive near clipping preserves both close-row visibility and overview depth precision. Local terrain and bucketed container/building clearance replace the blanket 110 m eye-height floor; conservative quay crane/vessel envelopes protect representative structures. These are navigation guards, not an engineering collision engine. The hill retains conservative approximate clearance. Longer preset moves from low viewpoints lift, cross above the scene, then descend; mouse input interrupts immediately. Ordinary mouse navigation requires no buttons.

Files changed in this pass:

1. `src/data/jnpa/portSpatial.ts`
2. `src/pages/ContainerYard/DigitalTwinViewport.tsx`
3. `src/pages/ContainerYard/components/Terminal3D.tsx`
4. `src/pages/ContainerYard/components/PortAssets.tsx`
5. `src/pages/ContainerYard/PortNavigation.tsx`
6. `src/pages/ContainerYard/navigationClearance.ts` (new)
7. `scripts/validate-port-spatial.cjs`
8. `scripts/validate-port-navigation.cjs`
9. `docs/3d-reconstruction.md`

Verified results:

- Build and lint passed. Vite retains the existing bundle warning (main chunk approximately 2.37 MB).
- Spatial checks passed for every eligible record: exact base/contact heights, no within-stack gaps/intersections, decreasing length support, block bounds, deterministic API-order-independent layout and unchanged source records. They also cover filter support chains, warehouse/bank separation, 609 land-edge samples and 376 bank corners across all six terminals.
- Actual browser inspection covered the overview and yard views of BMCT, NSICT, NSIGT, NSFT, APMT and NSDT. BMCT and NSICT were inspected closer, with multiple stacks/heights visible. Native left-drag orbit reached a low oblique view and no longer selected records at drag end. Wheel zoom, rapid wheel reversal, manual interruption of a preset, repeated overview/terminal/detail changes and right-click context-menu suppression were exercised.
- Selecting HLCU8503511 opened unchanged BMCT/BM-02/row 6/column 1/stored level 2 details, with its display-tier badge. Full Port retained both that selection and the BMCT Import count of 1,494. Page scrolling outside the viewport was verified (page scroll position 52 to 0).
- The real-controls event harness additionally tests right-drag vertical/horizontal pan, middle drag, immediate stop on release, fine trackpad-like deltas, reversal, limits, low views, safe overview return, drag-click suppression, normal clicks and listener cleanup. **The browser tool cannot hold a right/middle button during drag; these were harness tests, not physical browser right/middle-drag tests. No physical trackpad was available.** No hardware FPS benchmark is claimed.
- Original GeoJSON SHA-256 remains `4f115d3293cc7dca3d702f142d8236e044d1106b56b0fef4479a8bdd7724fbcb`. All six previously recorded MongoDB collection hashes still match. No backend, traffic pipeline, 2D map, packages or configuration were edited.

Remaining limitations: inconsistent stored levels are preserved, so display-tier packing is explicitly illustrative. Exact ISO twist-lock compatibility and operational stack validity are not established by this box-contact model. Coastline/context accuracy and camera clearance are approximate. Physical trackpad and held-button browser validation remain manual checks. The existing application services were reused and left running.
