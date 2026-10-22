# Operational data investigation (before changes)

Inspected 2026-10-16. This checkout has no .git directory, project_audit.md or implementation notes (only a template README and reference PDFs). Historical claims cannot be independently verified here.

## Current dependencies

MongoDB `smart_port_digital_twin` -> Spring Data models/repositories -> ContainerService (list/stats), DashboardService (invented historical proxies), ReportService (in-memory inventory filters/aggregates) -> /api/v1 -> frontend services -> per-component fetches.

Dashboard and Analytics combine global stats with independent container requests. The shared useContainers hook applies global yard filters, including on Port Map. Reports independently query the same collection. Yard and viewport each instantiate the hook; viewport selects actual container IDs. The map joins schematic IDs to container terminal strings. Static equipment.ts supplies cranes independently of MongoDB equipment.

## Confirmed source root causes

- Reports.tsx defaults to the last 30 days; DataSeeder uses May-July 2024 dates. A current period legitimately returns zero. Editing one date switches to Custom but retains the OTHER custom date from initialization, not the visible preset date. Prior broad-range zero is not yet reproduced.
- ReportService parses only ISO local dates; malformed dates and missing dates pass even bounded filters. Invalid requests are silently accepted. Trade and status share an overloaded field. Aggregations can throw on null group keys.
- ContainerService excludes empty containers from occupied slots; Analytics counts them (and gate-out) for utilization. Empty physical containers still occupy space.
- DashboardService multiplies current status counts into alleged 24-hour events and inventory into monthly TEUs; estimates vessels and generates a fixed 2023-24 trend. No historical event/vessel collections exist in the source.
- PortMap GeoJSON callbacks capture counts on layer creation; async results do not necessarily rebind popups. Global yard filters can hide other terminals and show misleading zero counts. Loading/errors are ignored.
- DataSeeder appends 11,410 synthetic records whenever count < 5,000; saveAll may overwrite overlapping IDs. AdminController.reseed deletes ALL five collections. Neither path may run during this investigation.
- jnpaLayout.ts duplicates terminal reference metadata (NSFT area differs from seeder); equipment.ts invents operational equipment separate from stored assets. Geometry is schematic, not a second inventory source.

## Intended flow and implementation order

MongoDB existing collections -> canonical read/filter rules -> inventory/report/dashboard APIs -> shared frontend inventory snapshot -> global overview pages and filtered yard. Keep geometry separate, linked by terminal code; use stored equipment IDs. Fix report boundaries first, then shared definitions, UI wiring and validation. Unsupported historical metrics must be unavailable rather than zero or fabricated.

Read-only MongoDB probe confirmed containers=11,713, terminals=6, equipment=30, environment_readings=7, vehicles=20. API was initially unreachable on port 8081. No data has been changed. Detailed schema quality and final validation will be recorded in data-architecture.md.
