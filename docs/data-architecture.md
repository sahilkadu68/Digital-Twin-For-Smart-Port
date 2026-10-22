# Operational data architecture and repair

Investigation: 16 October 2026, Asia/Kolkata. Read alongside [pre-change findings](data-investigation.md), [MongoDB schema/quality evidence](data-quality.json), and [API checks](api-validation.json).

## Outcome and evidence limits

Existing MongoDB records are preserved. No database/collection was dropped, cleared, reseeded, migrated, or corrected. The connection URI and database selection were not changed. Startup seeding is now off by default; the destructive development reseed endpoint returns 410 without repository access.

This directory is an extracted checkout: no `.git`, `AGENTS.md`, `project_audit.md`, or implementation notes were available. Native Git confirmed that it is not a repository. The only existing Markdown was a template README; `docs/reference/` contains PDFs, not implementation history. `modify.js` is an unused source-inspection snippet, not an operational generator. Historical implementation claims cannot be authenticated here.

The initial sandbox could not access localhost services. Read-only inspection with host access confirmed that MongoDB and an existing backend on 8081 were available. A separate repaired backend was tested on 8082, explicitly disabling seeding. The original server was not stopped or replaced. Its broad-range report also returned 11,713; the previously reported broad-range zero was **not reproduced**. A current 2026 date range legitimately has no records in this 2024 seed dataset.

## Database inventory and quality

| Collection | Count before / after | Purpose / provenance |
|---|---:|---|
| containers | 11,713 / 11,713 | Current tracked container documents; all `simulated=true` |
| terminals | 6 / 6 | Terminal reference metadata; no stored provenance flag; values occur in DataSeeder |
| equipment | 30 / 30 | Representative RTG subset; all simulated, not a complete crane inventory |
| environment_readings | 7 / 7 | Historical synthetic readings, June 22–28, 2024 |
| vehicles | 20 / 20 | Synthetic static vehicle/zone locations; not live traffic |

No vessel, berth-occupancy, movement-event, throughput-history, traffic-history, or GIS collections exist. No individual record was verified against an external operational source. Missing provenance must not be interpreted as verified real data.

Containers have uniform observed BSON types: string `_id`, containerNumber, status, type, shippingLine, cargoType, origin, destination, arrivalDate, terminal, yard, block; integer row/column/level; double weight; Boolean simulated. All 11,713 contain the audited fields. No `tradeCategory` is currently stored. Dates are strings from **2024-05-01 to 2024-07-02** with zero format mismatches. Every container terminal resolves to a terminal document. MongoDB schema variation for all five collections, including nullable terminal reference fields, is recorded in data-quality.json.

Quality defects remain explicit:

- **304 duplicate container-number groups**. Mongo `_id` is the stable identity; containerNumber is currently unsuitable as a unique lookup key.
- **1,633 duplicate slot groups**. Random seeded placement collides. Record counts are not measured physical slot occupancy. Frontend audit also includes yard in the slot key; the observed count remains 1,633.
- All container coordinates pass the current schematic bounds, but collisions and unsupported floating stacks mean this is not a verified stack model. A 3D object can overlap another object without either record being discarded.
- Equipment blocks `NS-01`/`NS-02`/`NS-03` do not match FT/IC/IG terminal block prefixes. Assets with no matching block are not silently relocated. Existing valid AP/BM assignments render from MongoDB.
- Only **seven distinct weights**, 0–31,109 kg, occur across all containers: the seeder derives weight from cargo-class bounds rather than each record. Size/status/cargo/route/date distributions are synthetic assumptions; shipping numbers are generated without a demonstrated ISO check-digit validation.
- Terminal capacity figures have no stored source date or unit evidence beyond the source-code slot interpretation. Estimated utilization uses those stored figures, not a newly asserted official capacity.

## Root causes and conflicting sources

| Evidence path | Finding | Repair |
|---|---|---|
| src/pages/Reports.tsx | Default last-30-days query excludes 2024 records; switching one date to Custom retained the other hidden custom date; no invalid-range validation | Default All Dates; accurate rolling-period labels and port-local dates; preserve both visible dates when editing; reject reversed ranges; clear stale report on failure |
| backend/.../service/ReportService.java | In-memory filters fail open on unknown/malformed stored dates or malformed request dates; null grouping keys can fail; trade conflated with status | Shared InventoryRules; validate request once; inclusive port-local calendar days; bounded queries exclude unknown dates; null-safe groups; independent optional trade field |
| backend/.../service/DashboardService.java | Estimated vessels; gate counts multiplied by 12/11; inventory multiplied by 288 for monthly throughput; fixed 2023–24 trend | Null unavailable historical metrics and empty historical series; no inferred events |
| backend/.../service/ContainerService.java and src/pages/Analytics.tsx | Dashboard excluded empty containers; Analytics included gate-out when calculating occupancy | Common record-based estimate: all records except gate-out; label estimate explicitly |
| src/hooks/useContainers.ts; DashboardCharts.tsx; Analytics.tsx; DigitalTwinViewport.tsx | Repeated independent requests, global yard filters leaked into overview pages | One shared inventory/terminal/equipment snapshot; stats, percentages, distributions and selections derive from it; only yard requests UI filtering |
| src/pages/PortMap.tsx | Leaflet callbacks captured pre-fetch counts; only five geometry features; errors/loading shown as zero | Rebind layer to snapshot version; explicit loading/error states; all six canonical terminals listed; NSDT boundary marked unavailable; clicks reset yard filters |
| src/data/equipment.ts; Terminal3D.tsx | Four static RTGs, default quay-crane counts and decorative docked ships looked like operational assets | Remove dummy RTG records, invented quay assets and ships; reuse stored equipment with explicit terminal/block relationships |
| src/data/jnpaLayout.ts | Reference metadata duplicated MongoDB, including conflicting NSFT area | Keep schematic geometry only; remove operational capacity/operator/crane metadata |
| backend/.../seed/DataSeeder.java; controller/AdminController.java | Startup append under 5,000 records; reseed unconditionally deleted all collections despite its protection claim | Seed off by default and never append to an existing container collection; reseed disabled |

The formerly cited `src/data/containers.ts`, summary datasets and sensor-map layers are already absent in this checkout; they were not deleted speculatively. Remaining `src/data/` files contain geometry or TypeScript types, not operational record generators. The unused static terminal-code list and unused independently aggregated terminal-stats helper were removed after reference searches. Backend seed generation remains an explicit opt-in fixture capability for empty collections and was never invoked.

## Current and intended data flow

Before:

```text
MongoDB -> repositories -> list/stats/report services -> independent component fetches
                       -> dashboard fabricated proxies -> dashboard/analytics
static equipment + duplicated terminal metadata + decorative vessels -> 3D
schematic GeoJSON -> map callbacks capturing initially empty filtered inventory
```

After:

```text
containers -> Container -> ContainerRepository -> ContainerService/InventoryRules
                                             -> ReportService/InventoryRules
                                             -> DashboardService/InventoryRules
terminals -> Terminal -> TerminalRepository ----+
equipment -> Equipment -> EquipmentRepository -+-> /api/v1 -> API clients
                                                  -> useInventory shared snapshot
                                                     -> Dashboard + Analytics
                                                     -> Map global terminal counts
                                                     -> useContainers(true) -> Yard/3D
                                                     -> selected Mongo _id -> details
geographic/schematic assets --stable terminal/block IDs--> map + 3D geometry
environment_readings -> EnvironmentReadingRepository -> EnvironmentService
                    -> /environment/current|trend -> dashboard/analytics
vehicles -> VehicleRepository -> /vehicles -> available API (no live traffic UI)
```

`backend/...` in this report abbreviates `backend/src/main/java/com/smartport/digitaltwin/`. Controllers for containers, reports, dashboard, terminals, equipment, environment and vehicles expose existing REST routes. Reports aggregate the live container collection in Java memory, not a historical transaction store. No hardcoded report figures are used. `/dashboard/throughput-trend` deliberately returns `[]` until history exists.

The shared client snapshot deduplicates concurrent fetches and publishes containers/terminals/equipment together after successful reads. It refreshes when a page mounts after 60 seconds or when Refresh inventory is pressed. It is not a streaming feed or a database transaction: separate collection reads can observe concurrent external changes. Reports use a fresh server query; differences during concurrent updates should be checked against snapshot/generated timestamps. No parallel operational copy is persisted in the browser.

## Canonical schema and relationships

| Entity | Canonical contract / compatibility |
|---|---|
| Container | Keep existing immutable Mongo `_id` exposed as `id`. `containerNumber` is an attribute; do not deduplicate or replace identity by this field. `type`: 20ft, 40ft, 40ft-HC, 45ft-HC. `weight`: kg; `cargoType`: general/refrigerated/hazardous/bulk/liquid/ro-ro. `terminal` references Terminal.code. `yard`, `block`, integer one-based row/column/level form the logical position. `arrivalDate` accepts ISO local date or offset timestamp on read; new ingestion must document precision and provenance. `simulated=true` means synthetic; false alone does not establish verified provenance. |
| Terminal | Existing Mongo ID remains untouched. `code` is the business relationship key (NSFT, NSICT, NSIGT, APMT, BMCT, NSDT). `name`, `operator`, `yardCapacity`, `berths`, `quayLength`, optional capacityMillionTeu/yardAreaHa/rtgcCount/rmqcCount are reference data. Missing source/unit dates must remain unverified. |
| Trade / status | New optional `tradeCategory` is import/export/transshipment/unknown, independent of operational `status`. Legacy explicit import/export/transshipment statuses supply read-time trade only; empty, gate-in/out, loaded, hold and inspection remain unknown trade. No missing trade is inferred from route or arrival. Existing statuses remain unchanged for compatibility. |
| Yard geometry | Geometry terminal ID joins Terminal.code; block IDs join `(terminal,yard,block)`. `yardGeometry.ts` documents schematic grid bounds; `jnpaLayout.ts` holds scaled scene footprints; GeoJSON holds schematic polygons. Geometry is not proof of surveyed coordinates. Position uniqueness and support constraints are quality requirements pending approved corrections. |
| Equipment | Existing Mongo ID plus equipmentId; type/status/utilization/liftsPerHour are stored values, not telemetry generated by rendering. `terminal` joins Terminal.code, `block` must resolve within that terminal. RTG scene position is derived from the referenced block only. Invalid block assignments remain unchanged and are omitted from positioning. |
| Environment | Existing timestamp strings with offsets, location, pollutant/weather/noise numeric values and conditions. Current data has no stable sensor/asset ID or geographic observation provenance; do not invent sensor positions. UI shows full observation date, loading/empty/error states. Trend is latest seven records, not necessarily seven days. |
| Vehicle | Existing Mongo ID, vehicleId/type/status, geographic coordinates, zone/destination, lastUpdated, simulated. Zone names are not canonical terminal foreign keys. Historical static points cannot establish current traffic flow or queue length. |

Relationships: Terminal 1:N Containers; terminal/block geometry 1:N Container positions and Equipment; snapshot selection uses Container.id. There are no existing vessel/event entities to reuse. Future event ingestion should use an immutable event ID, containerId, terminalCode, eventType, occurredAt (BSON instant), observed/source precision, source ID, provenance, and idempotency key. Gate-in, gate-out and handling events require their own evidence. Future vessel/berth records need stable vessel/voyage/berth IDs and observed occupancy intervals. These are **documented future contracts, not new populated collections**.

Dates: request bounds must be yyyy-MM-dd and start <= end; boundaries are inclusive calendar days in Asia/Kolkata. Offset timestamps are converted to the port day. Unknown/unparseable stored dates stay in unfiltered inventory but are excluded from bounded reports. A missing day is not treated as an event. TEUs use the retained project convention 20ft=1, 40ft/40HC/45HC=2 (45ft convention must be verified before official reporting). Missing/unknown types retain the legacy estimator and require ingestion quality controls before use with real data.

## Before / after validation

| Check | Before evidence | After executed result |
|---|---|---|
| Container total | Mongo read: 11,713 | Mongo, list API, stats API, unfiltered and broad reports: 11,713 |
| Broad custom range | Original 8081 API: 11,713; previous zero not reproduced | 2000-01-01 through 2030-12-31: API and browser 11,713 |
| Current 2026 month | Seed arrival range in 2024 | API correctly returns 0; explicit empty-report message |
| Report totals | Same stored source | 21,082 estimated TEUs; 189,665.1 tonnes |
| Occupancy estimate | Source excluded empty in dashboard, included gate-out in analytics | 11,343 non-gate-out records / 179,660 stored capacity = 6.3%; not physical occupancy measurement |
| Terminal totals | Mongo aggregate | BMCT 4,550; NSICT 2,515; APMT 1,664; NSFT 1,430; NSIGT 1,130; NSDT 424; API filters and browser map agree |
| 3D coverage | NSDT omitted from All Terminals scene type filter | NSDT maps to yard; browser displays 407 non-gate-out positioned records; overview includes all six tracked codes |
| 3D selection | Source uses Mongo IDs | Browser selected MAEU9745509, NSDT / DT-YARD / DT-01 / row 1 / column 3 / level 2 and displayed the stored details; ID endpoint equality checked for first/last inventory records |
| History | Fabricated scalars and monthly trend in source | Historical gate/vessel/throughput metrics unavailable; no generated events |
| Tests | No backend tests present | Five JUnit/MockMvc tests, zero failures/errors/skips; 49 read-only live API checks pass |
| Frontend | Available build/lint commands | `npm.cmd run build` and `npm.cmd run lint` pass; Vite retains the large-chunk warning |
| Exports | Existing jsPDF/XLSX utilities | Both browser export actions executed and returned to enabled controls; downloaded file contents were not independently parsed |

The browser verified Dashboard and Analytics totals, full report/custom range, map counts, NSDT navigation and real container selection. Automated pixel assertions, every possible 3D selection, API outage screenshots and full PDF/XLSX content validation were not performed. All source changes are local; no deployment or existing-process replacement was performed.

The yard import filter displayed 3,768 positioned records, and subsequent map navigation retained the six global terminal counts. Final validation servers on 8082 and the temporary Vite servers were stopped; the pre-existing backend and frontend processes were preserved. The final MongoDB audit still reports the original five collection counts. Restart the existing backend through its usual workflow to load the repaired sources.

## Files changed and why

- `backend/.../service/InventoryRules.java`: shared date, trade, matching, null and occupancy definitions.
- `backend/.../service/ReportService.java`: strict report filtering, normalized arrival grouping and safe group keys.
- `backend/.../service/ContainerService.java`: consistent matching, null-safe search and occupancy estimate.
- `backend/.../service/DashboardService.java`, `dto/DashboardSummaryDto.java`: remove unsupported historical calculations; nullable unavailable metrics.
- `backend/.../model/Container.java`: optional independent trade dimension; clarify provenance.
- `backend/.../controller/AdminController.java`, `seed/DataSeeder.java`, `backend/src/main/resources/application.properties`: remove destructive reseed path; disable startup seed; prevent append to existing inventory. Database connection configuration is unchanged.
- `backend/src/test/java/com/smartport/digitaltwin/service/InventoryConsistencyTest.java`: regression tests without DB writes.
- `src/hooks/useInventory.ts`, `src/hooks/useContainers.ts`: shared request lifecycle, snapshot stats/metrics, global overview versus yard filters and stable-ID selection.
- `src/pages/Reports.tsx`: All Dates, port-local presets, custom-bound preservation, errors/empty state and DB-derived terminal choices; existing exports preserved.
- `src/pages/Dashboard.tsx`, `src/pages/Analytics.tsx`, `src/features/dashboard/DashboardCharts.tsx`: use shared snapshot, consistent estimates and unavailable history.
- `src/pages/PortMap.tsx`: async count refresh, canonical names/all-terminal list, guarded selections, missing-boundary/error/loading handling.
- `src/pages/ContainerYard.tsx`, `src/pages/ContainerYard/DigitalTwinViewport.tsx`: canonical terminal choices, stored equipment, NSDT coverage, bounds/quality notice, full-inventory blockers, conflict-aware accessibility and camera typing cleanup.
- `src/pages/ContainerYard/components/Terminal3D.tsx`, `src/data/jnpaLayout.ts`, `src/data/equipment.ts`: remove invented operational assets and duplicate operational metadata while retaining scene geometry and types.
- `src/data/yardGeometry.ts`, `src/utils/inventoryQuality.ts`: explicit schematic coordinate bounds and nonmutating quality checks.
- `src/types/container.ts`, `src/services/dashboardService.ts`: reflect trade/provenance and unavailable historical metrics.
- `src/services/containerService.ts`, `src/services/terminalService.ts`, `src/constants/index.ts`: reject ambiguous number lookup; remove unused independent aggregate helper/static terminal definitions.
- `src/services/api.ts`, `src/services/environmentService.ts`, `src/features/dashboard/EnvironmentPanel.tsx`: correct 204/empty/error handling and show historical observation date.
- `src/layouts/Topbar.tsx`: snapshot refresh/retry and timestamp.
- `scripts/inspect-data.js`, `scripts/validate-api.mjs`, `docs/data-*.md`, `docs/data-quality.json`, `docs/api-validation.json`: repeatable read-only audits, schema, root causes and validation evidence.

## Required future work (separate from completed repairs)

1. **Data realism and provenance:** obtain authoritative source records and source contracts. For simulation calibration, extract official JNPA annual/monthly totals with publication date, period, units, source URL and explicit conversion assumptions. No new official statistic was needed or asserted for these integrity fixes. Do not convert annual TEUs into invented individual transactions. Weight/type/trade/status/cargo/date/dwell distributions need independent calibration and consistent inter-field constraints.
2. **Approved data correction:** resolve duplicate numbers and slot conflicts only against an authoritative record source. No automatic deduplication is safe. Invalid equipment prefixes need a reviewed before/after document patch. Do not infer specific replacement slots, trade categories, check digits or history from random seed values.
3. **Reversible correction procedure:** first export the exact affected documents and indexes, record collection counts and per-document hashes, and prepare an `_id`-keyed dry-run manifest with original/expected/replacement values and reasons. Review the manifest before approval. Apply only compare-and-set updates whose original values still match; record rollback values and reject concurrent changes. Roll back by `_id` and expected replacement values. No migration is required for the present optional read-compatible field and no write manifest has been applied. Concrete replacement values remain blocked on authoritative evidence.
4. **History:** ingest timestamped gate/handling events before claiming 24-hour movements, throughput, dwell, daily snapshots or retention metrics. Add verified vessel/voyage/berth observations before schedules or berth occupancy. Arrival dates cannot backfill these histories.
5. **Geographic coverage:** verified boundaries for all terminals (NSDT currently absent), quay edges, yard/block surveys, gate/road/rail links through Karal Phata, asset/sensor positions and reference provenance. Preserve stable terminal IDs; reconcile the two schematic views against surveyed transforms.
6. **Traffic:** ingest authorized vehicle observations with timestamp/freshness, stable vehicle/route/zone IDs and real road topology. Current 20 synthetic static records cannot support live queues or movements.
7. **3D integrity:** correct colliding/unsupported stacks, model mixed physical lengths and collision-free slot occupancy, reconcile equipment block IDs, add verified asset placement and test all geometry joins. Use retrieved historical events for playback; never infer movement from render animation.
8. **Scale/operations:** move large collection filtering/aggregation into indexed Mongo queries after agreeing on date storage and units; assess pagination and consistent snapshot semantics. Any date normalization/index migration needs the approval procedure above. Add broader CI/browser/export checks; split the existing large frontend bundle separately.
