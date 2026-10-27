# Authentication and operational reports

Implemented 27 October 2026. This is a focused implementation record, not production certification.

## Existing implementation and report audit

No authentication/user model existed. Operational APIs were public. The React application used `apiFetch` and a shared Zustand inventory snapshot. Reports already filtered terminal, trade and inclusive arrival dates, grouped status/type/cargo/terminal/arrivals, and exported with jsPDF/AutoTable and SheetJS. These mechanisms and chart layout are preserved.

Issues corrected: unknown container sizes previously contributed guessed TEUs; invalid weights could corrupt totals; active/departed counts, capacity context, quality warnings and environmental freshness were absent. PDF omitted cargo/quality context. Export failures were not shown. Editing filters could leave an older report available for export.

## Setup and authentication

1. Start MongoDB normally. Run `mvn spring-boot:run` in `backend`, and `npm run dev` in the project root. Operational startup seeding stays disabled.
2. Open `http://localhost:5173`. Register an email and a unique 12–72 character passphrase (at most 72 UTF-8 bytes), then sign in. No default account/password is created. Use the same host consistently: localhost and 127.0.0.1 are different cookie sites.
3. New accounts are stored in `user_accounts`: normalized email as unique MongoDB `_id` and BCrypt hash (cost 12). No port inventory/equipment/traffic records or prior credentials are migrated/overwritten. No prior account model was found. Password hashes never appear in API responses.
4. All users have the same USER permission for the existing shared workspace. Server-side sessions use HttpOnly, SameSite=Lax, cookie-only JSESSIONID, 30-minute inactivity expiry and session-ID rotation. POST logout requires CSRF and invalidates the session/cookie.
5. All endpoints require authentication except login/register/CSRF and error handling. Existing frontend routes redirect to sign-in. `apiFetch` includes cookies and obtains CSRF before mutations. No credentials/tokens are stored in localStorage. Expired authentication clears inventory and guards against old pending responses repopulating it.

| Environment variable | Default / deployment requirement |
|---|---|
| `MONGODB_URI` | Existing local MongoDB connection; deployment credentials belong in backend environment/secret manager |
| `FRONTEND_ORIGIN` | Exact origin, default `http://localhost:5173` |
| `SESSION_COOKIE_SECURE` | Local HTTP `false`; **must be `true` with HTTPS in deployment** |
| `AUTH_REGISTRATION_ENABLED` | `true` for account creation; disable after approved accounts exist for restricted deployments |
| `AUTH_RATE_WINDOW_SECONDS` | 900 |
| `AUTH_RATE_IP_LIMIT` | 30 login/registration submissions combined per window/IP |
| `AUTH_RATE_ACCOUNT_LIMIT` | 10 login submissions per window/normalized identifier |
| `VITE_API_BASE_URL` | Frontend only, `http://localhost:8081/api/v1` |

Never put backend credentials in VITE variables. CORS permits the configured exact origin with credentials; Retry-After is exposed. Standard Spring Security headers/no-store responses remain enabled. API failures use safe messages and never log passwords or request bodies. Authentication bodies require Content-Length and at most 8 KiB; chunked bodies are rejected. Form/header limits are also configured.

## Throttling and security limitations

Atomic MongoDB counters in `auth_rate_limits` are shared across backend instances. Keys contain a SHA-256 digest of IP/identifier plus time window, with TTL cleanup. HTTP 429 includes Retry-After. Limiter/database failure fails closed with 503. Fixed windows reset rather than permanently locking an account, but allow boundary bursts; shared/NAT IPs share limits.

Sessions themselves are servlet-local. Use one backend instance or sticky sessions; distributed sessions require a separate deployment change. The limiter uses socket remote addresses, not untrusted forwarded headers: trusted proxy/client-IP configuration must be handled at deployment. Public HTTP is for local development only; deploy behind correctly configured HTTPS. Registration grants workspace access, so disable it for restricted deployments. Password reset, email verification, MFA and role administration are absent. Legacy anonymous validation scripts now need a session; do not disable security to run them.

## Report definitions and limitations

- Status filtering now joins terminal/trade/date filtering. Changing controls clears the old snapshot; request versions suppress stale responses. UI/PDF/Excel use the generated report's same filters.
- Active matching records exclude only gate-out, including empty and hold records. Departed matching records are gate-out. Total records/TEUs/weight retain all matching statuses.
- Utilization is `round(filtered active / selected terminal capacity * 100, 1)`. This is a **cohort estimate**, not historical/as-of occupancy. All Dates/all statuses/all trades matches dashboard semantics for valid records. Missing/zero/duplicate capacities produce unavailable values; values above 100% are retained with warnings. Display thresholds: high >=85%, at/above capacity >=100%; these are not asserted port policy.
- Container model declares kilograms; valid recorded weights are divided by 1000. Negative/non-finite values are excluded and counted. Missing primitive numeric values cannot be distinguished from zero without a schema change.
- Project TEU convention: 20ft=1; 40ft/40ft-HC/45ft-HC=2. Unknown sizes are excluded and counted, rather than guessed.
- Quality counts cover the filtered cohort: missing numbers/dates, unknown sizes, invalid weights, basic placement fields/levels outside 1–4, duplicate-number groups and conflicting slot groups. These checks do not certify full stack/geographic validity, delete identities or move records. Block capacities are not inferred from schematic 3D grids.
- Latest environmental snapshot is port-wide and independent of inventory filters, explicitly simulated/unverified. Existing display conditions/units are retained; no regulatory threshold is invented. Stale means >24h old or >5min in the future; invalid timestamps have unknown freshness. Inventory has no update timestamp: generatedAt is query time, not source freshness.
- No throughput, departure history, vessel turnaround, equipment downtime, berth productivity or real traffic metrics are invented. Traffic remains simulated and untouched. Existing environmental trend API remains available elsewhere; this report adds the latest snapshot.
- PDF preserves repeated table headers, page numbers and existing tables, adding operational/quality/environment/cargo/definition tables with pagination. Excel gets the same context in an Operations & Quality sheet. Filenames include terminal and generation timestamp; export errors are displayed.
- Existing in-memory report aggregation is retained at the current approximately 12k-record scale. Reads are not a cross-collection transaction. Production-scale aggregation/pagination and distributed sessions remain limitations.

## Changed files and purpose

- `backend/pom.xml`: required Spring Security runtime/test dependencies.
- `backend/src/main/java/com/smartport/digitaltwin/security/`: `UserAccount`, `AccountService`, `AuthController`, `AuthRateLimiter`, `AuthProtectionFilter`, `SecurityConfig`, `ApiExceptionHandler`: persistence, password/session/CSRF, throttling and safe errors.
- `backend/src/main/resources/application.properties`, `.env.example`, `.gitignore`, backend `config/CorsConfig.java`: authentication setup, cookies, limits, CORS and secret/dump exclusions.
- Backend `controller/ReportController.java`, `dto/ReportSummaryDto.java`, `dto/ReportOperationsDto.java`, `service/ReportService.java`, `service/ReportOperations.java`: status and operational/quality context.
- `src/App.tsx`, `src/pages/Login.tsx`, `src/store/authStore.ts`, `src/services/api.ts`, `src/layouts/Topbar.tsx`, `src/hooks/useInventory.ts`: login, registration, logout, protected routes, CSRF/cookies and cache clearing.
- `src/pages/Reports.tsx`, `src/services/reportService.ts`, `src/utils/reportExport.ts`: report controls/context and consistent PDF/Excel exports.
- Backend tests `security/AuthenticationTest.java`, `security/AccountAndRateLimiterTest.java`, `service/ReportOperationsTest.java`, updated `service/InventoryConsistencyTest.java`: focused regressions and updated constructor fixtures.
- `scripts/validate-report-exports.cjs`: actual export implementations exercised in memory with labelled fixtures; no database writes.
- This document: audit, setup and limitations.

## Validation scope

Final command results are in the completion response. MockMvc tests exercise login/logout, fixation prevention, CSRF rotation, CORS, unauthorized reports, registration/duplicates, hashing, request limits and throttling with mocked MongoDB collaborators. They verify hash insertion arguments and atomic counter behavior without creating real accounts. They do not prove live MongoDB account round-trips or wall-clock servlet expiry. Export tests inspect actual PDF content/page counts and parse workbook buffers for 0, 3 and 500 test arrivals. Browser protected-route/login checks are distinct from authenticated workspace end-to-end testing. Visual PDF readability and all authenticated pages are not claimed without inspection.
