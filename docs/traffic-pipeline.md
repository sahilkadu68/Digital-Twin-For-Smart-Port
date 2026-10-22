# Persisted simulated traffic and pipeline review

Verified 17 October 2026 against local MongoDB and Spring Boot. This extends, rather than supersedes, `data-architecture.md`. No operational documents, MongoDB connection settings, package files or 3D scene were modified.

## Traffic pipeline

`jnpa_roads_candidate.geojson` -> explicit Java TrafficSeeder/TrafficGenerator -> `simulated_traffic` -> TrafficRepository -> TrafficService -> TrafficController -> frontend trafficService -> existing Leaflet RoadNetworkLayer.

- 2,893 original roads; 8,679 persisted documents, 2,893 per scenario (`normal`, `peak`, `severe`). The default inspection scope still selects 1,045 complete ways. Full road network displays all 2,893.
- Mongo `_id` is `<scenario>:<OSM @id>`. Unique compound index `traffic_road_scenario` on roadId/scenario. Road metadata retains the original tags. The road geometry remains solely in the preserved GeoJSON.
- Documents contain roadId, scenario, score, level, estimatedSpeedKmh, baselineSpeedKmh, speedBasis, simulated=true, sourceSha256, modelVersion, generatedAt and roadMetadata. `generatedAt` is simulation generation time, not an observation timestamp.
- Model `shared-vertex-v1`: road-class load plus exact shared-vertex degree; eight rounds of neighbour pressure propagation. Distinct layer tags are kept separate. No snapping, spatial crossing inference, random road colors, real demand or live activity. One-way and turn restrictions do not drive this undirected illustrative model.
- Numeric maxspeed tags (including mph) provide speed baselines where usable; otherwise conservative class assumptions are labelled explicitly. Unknown classes without a usable tag have no speed estimate. These are not measured speeds or independently verified local speed limits.
- The frontend fetches the selected persisted scenario through the existing API wrapper. No score generator remains in React. Scenario requests are cancelled/guarded; old scenario colors clear immediately. Loading, empty, invalid, partial, mismatched-source and failed responses show grey roads, with retry on errors. Traffic off restores existing road-class styling.
- The frontend hashes the actual fetched road bytes using Web Crypto and verifies the reviewed source revision and backend record hashes. Traffic requires localhost/HTTPS checksum support; road geometry can still load when checksum verification is unavailable.
- Road picking continues to use the non-interactive shared canvas and map click handler, preserving terminal polygon/popup interactions. Selected details update from the current backend response.

### APIs

- `GET /api/v1/traffic?scenario=normal|peak|severe` -> `{scenario, simulated:true, records:[...]}`. Empty collection -> empty records. Unknown scenario -> 400.
- `GET /api/v1/traffic/road?scenario=peak&roadId=way%2F45096112` -> persisted record; unknown road -> 404.
- No public traffic write/seed endpoint is exposed.

### Repeatable seed

From `backend/`, using the existing configured MongoDB URI/database:

```powershell
mvn -o spring-boot:run "-Dspring-boot.run.arguments=--app.data.seed-on-startup=false --app.traffic.seed=true"
```

Traffic seeding is independently opt-in; normal startup does not seed traffic or invoke operational seeding. The default source is `../jnpa_roads_candidate.geojson` relative to the backend working directory; use `--app.traffic.source=<absolute-path>` for another working directory. No copy/re-export is required.

The full source is validated before writes. Bulk upserts use only `$setOnInsert` in `simulated_traffic`. Re-runs fill missing records but never overwrite existing records, delete data or clear unrelated collections. Changed model/source revisions require an explicit reviewed migration; seeding intentionally does not replace old snapshots. The client rejects incompatible data instead of fabricating a fallback.

## Existing pipeline audit

| Feature | Source / evidence | Result and action |
|---|---|---|
| Dashboard / analytics | `useInventory` -> container/terminal/equipment services -> controllers/repositories -> MongoDB; shared record-based aggregates. Dashboard history API deliberately returns unavailable/empty values. | 11,713 containers, 11,343 non-gate-out records, 179,660 stored capacity, 6.3% estimated utilization. API/report totals agree. No fabricated history added. |
| Inventory / search / yard | `useContainers(true)` filters the shared API snapshot; ContainerController/ContainerService support server filters and stable-ID retrieval; yard renders Mongo IDs. | 49 existing API regression checks pass, including type/status/terminal filters, first/last ID lookup and report totals. 304 duplicate number groups and 1,633 conflicting slot groups remain; no unsafe deduplication/repositioning. |
| Terminal inventory / details | TerminalController -> TerminalRepository; shared snapshot and PortMap inventory. | Six terminals and detail endpoints verified; sum of per-terminal container counts is 11,713. Geometry remains schematic; NSDT has no mapped boundary. Static layout metadata is not authoritative geography. |
| Equipment / 3D joins | EquipmentController -> EquipmentRepository -> shared snapshot -> DigitalTwinViewport block joins. | 30 records; terminal references resolve. Legacy NS-01/02/03 equipment blocks do not resolve to FT/IC/IG block prefixes. They are not silently relocated. Existing AP/BM relationships and Mongo IDs preserved. |
| Vehicles | VehicleController -> VehicleRepository. | 20 static synthetic records; API contract/unique IDs verified. No active live-traffic UI uses these records. They were not repurposed as measured traffic or truck movements. |
| Environment | EnvironmentController -> EnvironmentService -> EnvironmentReadingRepository; EnvironmentPanel and analytics service. | Seven historical observations, 22–28 June 2024. Current/trend API responses verified; empty readings have explicit no-data behaviour. Removed unsupported `WSW` direction text from Wind Speed label; regression-tested and confirmed on reloaded backend. No direction field supports that claim. |
| Reports / exports | Reports page -> reportService -> ReportController/ReportService -> same container collection; XLSX/PDF exports consume returned summary. | All dates and broad range both 11,713; 21,082 estimated TEUs. Date/type/status/trade/terminal checks and invalid date/trade 400s pass. Current 2026 range correctly returns zero for 2024 inventory. Export files were not re-tested visually in this task. |
| Road geometry / traffic | Preserved GeoJSON + separate display scope; new persisted traffic path above. | Scope/geometry/terminal controls preserved. Actual frontend API code and road component tested against persisted HTTP values, with Leaflet/React-hook mocks; browser navigation unavailable. |

Static colors, camera defaults, schematic geometry and stored terminal capacity references are intentional presentation/reference values, not parallel operational datasets. Historical throughput, vessel occupancy, gate events and verified routing remain unavailable.

## Executed verification

- `mvn -o test -q`: 10 tests passed (5 existing inventory, 4 traffic, 1 environment); no failures/errors/skips. JVM emitted dynamic-agent warnings.
- Frontend build and full lint passed. Vite retains the existing large-chunk warning.
- `node scripts/validate-traffic.mjs`: 28,946 assertions against all persisted scenarios, including IDs, original metadata, source hash, monotonic scores, individual detail API, invalid scenarios, empty/partial/duplicate/mismatched records, API failure and cancellation. Actual frontend `apiFetch` and traffic service executed against HTTP.
- `node scripts/validate-traffic-map.cjs`: real component code with real traffic API/service values; mocked Leaflet/React hooks. Verified color/details response use, pending/empty/error/retry, cancelled late scenario responses, scope changes, visibility and cleanup. This is not a browser or pixel test.
- Both scripts passed against the separate backend on 8082 and the existing reloaded backend on 8081. The existing backend acquired the compiled endpoints through its reload mechanism; it was not stopped/replaced by this task. `GET /environment/current` on 8081 confirmed `Wind Speed` without the unsupported direction.
- Existing `scripts/validate-api.mjs` executed against 8082 with its report-file write suppressed: 49 checks passed. Additional terminal detail/equipment/vehicle/environment API checks passed.
- First traffic seed inserted 8,679 records; second inserted zero. Traffic collection hash stayed `65b278b603046ebfb4857b83f2343f3b664ca000f0665947fd6e26acb7605e7d`; no duplicate road/scenario pairs; unique index verified.
- Original GeoJSON and emitted build asset SHA-256: `4f115d3293cc7dca3d702f142d8236e044d1106b56b0fef4479a8bdd7724fbcb`.
- Full-document hashes of all five operational collections matched before/after (not merely their counts). Counts stayed containers 11,713; terminals 6; equipment 30; environment_readings 7; vehicles 20.
- Browser attempts on the isolated frontend timed out. No claim of browser scenario/road-selection or 3D visual validation is made. Temporary validation servers are stopped at task completion; existing 8081/5173 processes are retained.

Run traffic checks from the project root; default validation API is 8082. For the normal application backend:

```powershell
$env:VALIDATION_API_BASE='http://localhost:8081/api/v1'
node scripts/validate-traffic.mjs
node scripts/validate-traffic-map.cjs
```

## Files changed

- Backend additions: `model/TrafficRecord.java`, `repository/TrafficRepository.java`, `service/TrafficService.java`, `controller/TrafficController.java`, `seed/TrafficGenerator.java`, `seed/TrafficSeeder.java`, under `backend/src/main/java/com/smartport/digitaltwin/`.
- Backend fix: `service/EnvironmentService.java`, same base path, removes the unsupported wind-direction label.
- Backend tests: `backend/src/test/java/com/smartport/digitaltwin/service/TrafficPipelineTest.java`, `EnvironmentPipelineTest.java`.
- Frontend: `src/components/map/RoadNetworkLayer.tsx`, `src/data/jnpa/simulatedTraffic.ts`, new `src/services/trafficService.ts`.
- Reproducible checks: `scripts/validate-traffic.mjs`, `scripts/validate-traffic-map.cjs`.
- This report: `docs/traffic-pipeline.md`.

## 3D work remaining

The existing 3D scene is preserved. Safe next work must account for duplicate physical slot assignments, unsupported stacks, unresolved NS equipment block relationships, schematic terminal/block dimensions and missing surveyed geography. Correcting Mongo records or inventing asset/gate coordinates would not be a safe continuation. No movement/event history exists to justify traffic-driven truck animation or operational playback. The new traffic pipeline supplies explicitly simulated road-level values only.
