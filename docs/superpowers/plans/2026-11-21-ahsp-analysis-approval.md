# Approval Analisis AHSP Implementation Plan

**Goal:** Allow public users to propose complete analysis for Need re-verified AHSP items and allow a PIN-authorized admin to approve or reject it.

**Architecture:** Store submissions separately and keep the catalogue unchanged until an atomic privileged approval RPC validates the item snapshot. Reuse MPTK search as component suggestions and show pending submissions on a PIN-protected approval page.

**Tech Stack:** Next.js 16.3.4 Route Handlers, React 19, Supabase/PostgreSQL, Zod, bcryptjs, jose.

**Spec:** `docs/superpowers/specs/2026-11-21-ahsp-analysis-approval-design.md`

## Global Constraints

- Public requests never write directly to `ahsp_items`.
- Approval PIN is server-only; approval session is scoped, short-lived, and HttpOnly.
- SQL migrations are applied manually in Supabase SQL Editor.
- Do not change the existing RAB matching workflow.
- Formula strings are stored, never evaluated.

## Review Focus

- Stale proposals must not overwrite item changes; compare snapshot inside the approval transaction.
- Public submissions must be bounded and reject incomplete component identities/coefficient sources.
- Formula `0` is absent; numeric coefficient `0` is retained.
- Wrong PIN and expired session cannot read or mutate the queue.
- Approved manual analyses must satisfy the catalogue and MPTK constraints.

### Task 1: Submission and approval data contract

**Files:**
- Create `supabase/migrations/202611210001_ahsp_analysis_approvals.sql`
- Modify `docs/ahsp.md`
- Create `scripts/generate-ahsp-approval-secrets.mjs`

- [x] Add submissions/attempt-limit schema, manual analysis provenance constraint, service-role-only approval RPC, and SPTJM MPTK support.
- [x] Verify SQL definitions and migration ordering by inspection; do not run against the remote database.

### Task 2: Server trust boundary

**Files:**
- Create `lib/ahspApproval.ts`
- Create `app/api/ahsp/analysis-submissions/route.ts`
- Create `app/api/ahsp/approval/session/route.ts`
- Create `app/api/ahsp/approval/submissions/route.ts`
- Create `app/api/ahsp/approval/submissions/[id]/route.ts`

- [x] Validate public submission payload and item eligibility on the server.
- [x] Verify bcrypt PIN, throttle failures, set/clear scoped short-lived session cookie.
- [x] Protect queue and decision endpoints with session and same-origin checks.
- [x] Route decisions through the transactional RPC and return stable errors.

### Task 3: Contributor and admin interfaces

**Files:**
- Create `app/ahsp/analysis-submission.tsx`
- Create `app/ahsp/approval/page.tsx`
- Create `app/ahsp/approval/ui.tsx`
- Create `app/ahsp/approval/ui.module.css`
- Modify `app/ahsp/catalog.tsx`

- [x] Show a public proposal form only for non-SMKK Need re-verified items.
- [x] Reuse existing MPTK values as search suggestions and permit new names.
- [x] Provide an admin PIN unlock, queue, item/source review, reject note, and explicit identity/regulation confirmation before approval.

### Task 4: Compatibility, documentation, and verification

**Files:**
- Modify `lib/ahsp.ts`, `app/api/ahsp/mptk/route.ts`, and relevant docs.
- Modify `.env.example` only if the file exists and is the active environment template.

- [x] Document PIN hash/session secret configuration and manual migration order.
- [x] Run typecheck and lint on changed files and inspect the final diff. Production build was attempted twice but the shared `.next` output returned Windows `EPERM` during directory creation.
- [x] Report that remote behavior remains unavailable until the user applies the migration and configures the two server secrets.
