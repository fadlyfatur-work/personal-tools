# Report ASB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build protected `/report` with daily ASB snapshots, table editing, account/package detail, history charts, Excel input and PDF output.

**Architecture:** Validate daily JSON snapshots through one domain module and save with optimistic concurrency in a service-role-only SQL RPC. Two role-specific plaintext PINs (explicit user instruction) issue report-only signed sessions. Reuse existing theme, libraries and Node assertion test loader.

**Tech Stack:** Next.js 16.3.4, React 19, TypeScript, Supabase, Zod, jose, PizZip, jsPDF, Recharts, CSS Modules.

**Spec:** `docs/superpowers/specs/2026-11-11-report-asb-design.md` (approved for execution in chat, including green/completion and pale blue/incomplete cells).

## Global Constraints

- No new runtime dependencies; reuse this checkout and preserve unrelated edits. No unsolicited commit, push, deployment or live SQL application.
- Read installed Next.js docs before product code. PIN literals never enter committed sources or returned data.
- Supabase migrations applied manually; prepare one ignored activation SQL including seed and supplied PINs for the operator.
- User-approved skills: design-taste (contextual quality rules; data table is outside marketing layouts), apple-design, antislop-ui during, ponytail full.
- Native inline execution: user explicitly requested execution, so no additional plan approval round. Retain a progress ledger under `.next/report-work/` rather than adding scratch rules or shell-dependent skill wrappers.
- Sorting: completed package steps descending, recorded account stage descending, first proven progress ascending, source order final; stable during draft editing.

## Review Focus

1. Incomplete historic data must not become zero, an invented account identity, a complete province total or a false national percentage.
2. Partial package/account detail and Excel edits must not erase absent rows or silently reduce already-known totals.
3. Concurrent save, session revocation and changing report date with a dirty draft must preserve user data and enforce roles.
4. Spreadsheet ZIP/XML content, untrusted IDs and PIN attempts must meet bounded validation even when using installed libraries.
5. Long package names, 38 rows, mobile keyboard and dark mode must retain readable status labels, accessible details and complete PDF output.

### Task 1: Snapshot domain and source seed

**Files:** Create `lib/report/model.ts`, `scripts/test-report.mjs`.
**Interfaces:** Produce `ReportDocument`, `ProvinceReport`, `ReportSnapshot`, `createSeed()`, `validateDocument(value)`, `prepareDocument(input, previous, now)`, `sortProvinces(rows)`, `summarize(document)`, `integration(total, integrated)` and `carryForward(snapshot, date)`.

- [x] Write assertions for 38 provinces, six role counts 15/1/2/0/2/0, nullable integration, known-zero, invalid counts, partial details, timestamps, copy isolation and sort behavior.
- [x] Run `node scripts/test-report.mjs`; expect missing implementation assertion.
- [x] Implement exact PDF status seed, strict schema, canonical server timestamps and deterministic summary/sorting. No invented overall progress formula.
- [x] Run domain assertions; expect PASS.

### Task 2: PIN sessions, atomic database save and setup

**Files:** Create `lib/report/session.ts`, `lib/report/server.ts`, `app/api/report/route.ts`, `app/api/report/auth/route.ts`, `app/api/report/access/route.ts`, `supabase/migrations/202611110001_report.sql`, `scripts/setup-report.mjs`, `scripts/test-report-api.mjs`.
**Interfaces:** Consume Task 1; produce `/api/report` GET(date/history), POST(date, revision, document, source, reason), `/auth` GET/POST/DELETE, `/access` GET/PUT. All JSON success uses `{data}`, errors `{error,code}`.

- [x] Write API assertions with DB/cookie adapters for unauthenticated, wrong role, origin, access revocation, invalid PIN, malformed snapshot and conflict revision. Run and see expected failure.
- [x] Implement signed 8h report sessions, live access-version checks, same-origin and shared limiter. Plaintext PINs stay in service-role table; no API returns them.
- [x] Implement SQL transaction with advisory lock/revision compare; seed/upsert setup cannot overwrite existing daily data or silently reset PINs.
- [x] Run API tests and inspect SQL grants/RLS. Prepare manual activation artifact after final build; preserve `.env.local` when adding session secret.

### Task 3: Excel round-trip and PDF report

**Files:** Create `lib/report/excel.ts`, `lib/report/pdf.ts`, `scripts/test-report-files.mjs`.
**Interfaces:** Consume Task 1; `createReportWorkbook(document,date): Uint8Array`, `readReportWorkbook(bytes,document,date): {document, changes}`, `createReportPdf(snapshot): jsPDF`.

- [x] Write checks for workbook archive/round-trip, partial merge, wrong date, duplicate rows, foreign IDs, formulas and decompression limits; PDF 38 rows/appendices/unknown values. Run and observe failure.
- [x] Implement workbook with Petunjuk/Provinsi/Akun/Paket, version metadata and ordinary Excel shared/inline strings. Reuse PizZip and browser XML parser; limit upload, uncompressed bytes, rows and reject DTD/formulas.
- [x] Implement A3 landscape PDF using same sort/status colors; append full package detail on additional pages and preserve source caveats.
- [x] Run file checks; render PDF for visual inspection during final verification.

### Task 4: Report UI and charts

**Files:** Create `app/report/page.tsx`, `app/report/report-client.tsx`, `app/report/report-details.tsx`, `app/report/report-chart.tsx`, `app/report/report.module.css`; modify only report link in existing `app/menu/page.tsx`.
**Interfaces:** Consume Task 1-3 endpoints, model and file helpers. Use SuiteSurface/ThemePicker; dialogs native `<dialog>` with focused controls/Escape.

- [x] Implement PIN gate, date load/create, stable draft edit/save/cancel, account hover/click details, package details/timestamps, complete/error states and admin PIN controls. No local fake-data fallback.
- [x] Add workbook preview/apply-to-draft, stored-revision PDF download, charts with date range/province filter and readable series table. Unknown metrics are gaps.
- [x] Style around the source table; green complete, pale blue incomplete; responsive containment, keyboard/focus, both themes, press feedback and reduced motion. Marketing heroes, decorative images and motion libraries are inappropriate for this data surface.
- [x] Check TypeScript and browser behavior (test-only network adapter may serve the real PDF seed when live SQL is not activated). Actual runtime must fail closed on missing setup.

### Task 5: Verification and handoff

**Files:** Create `docs/report.md`, `docs/implementation-timeline/report/README.md`, `docs/implementation-timeline/report/2026-11-11-report.md`; update feature/doc indexes narrowly.

- [x] Run domain/API/file checks, targeted lint, typecheck and build; record baseline unrelated errors separately.
- [x] Use a fresh reviewer for report-specific code/spec/plan; fix important defects with regression assertions, then rerun affected checks.
- [x] Inspect desktop/mobile/light/dark and PDF render; record exact limits for unactivated live database.
- [x] Generate `.next/report-activation.sql` with schema, supplied role PINs and idempotent PDF seed, and `.env.local` session secret if absent. No live migration or publishing.
- [x] Update docs with setup, verification and remaining operator action. Leave work in current checkout, no automatic commit.

