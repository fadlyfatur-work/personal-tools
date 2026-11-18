# RAB AI Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Import Excel, PDF and images into the existing RAB reconciliation with configurable AI profiles and inspectable redacted requests/responses.
**Architecture:** Browser PDF.js extracts digital text or rasterizes selected pages. Manager-only server endpoints render saved JSON templates, call public HTTPS endpoints, validate extracted items and return session-only traces. Confirmed rows reuse the existing matcher, storage and XLSX exporter.
**Tech Stack:** Next.js 16, React, Zod, Supabase, Node crypto/HTTPS, PDF.js.
**Spec:** Accepted discussion in this chat; concrete contract below.

## Contract and rulings

- Indonesian UI, existing AHSP themes; Excel behavior remains compatible.
- PDF/image: 10 MB per source, at most 10 selected pages, 1,000 total extracted items; limits shown before paid calls. No silent truncation.
- Manager access uses server-configured `AHSP_AI_ADMIN_TOKEN` (minimum 32 characters), entered in memory in this tab. This avoids creating a separate account system on public AHSP. All paid calls and profile operations require it.
- Profiles live in `ahsp_ai_profiles`; API secrets use AES-256-GCM with a separate 32-byte `AHSP_AI_ENCRYPTION_KEY`. SQL migration is supplied for manual application per repository procedure. Missing setup yields actionable errors, never a local-storage substitute.
- Per-profile URL/model/headers, OCR and JSON request templates/prompts/response paths, item/field mapping; presets plus custom editing. No JavaScript evaluation.
- HTTPS only, public DNS pinned per request, no redirects, bounded timeout/payload/response. Server redacts secrets and base64 attachments before returning traces.
- Logs stay in the running page (maximum 30 traces), can be copied/downloaded, and are not saved to the database or browser sessions. Explicitly chosen default because retention was unanswered.
- Every AI import requires human confirmation before matching; ambiguous numeric text remains null. Raw values and original page references survive save/export.
- Native execution in current checkout on a feature branch; no automatic commits, push, remote migration, or external AI call without supplied credentials.

## Review focus

- Template substitution preserves JSON types and quotes; missing/unknown placeholders fail before network activity.
- Secrets reflected by upstream errors must be redacted from every returned trace.
- Private/mapped IPv6 addresses and redirect destinations cannot bypass outbound restrictions.
- Cancellation, changing files and retries must not replace newer results with stale requests or discard previous traces.
- OCR rows with null/ambiguous amounts or duplicate page occurrences must preserve evidence and enter normal reconciliation safely.

## Tasks

- [x] 1. Implement `lib/ahspRabAi.ts`: templates, mappings, validation, redaction and RabRow conversion. Initial checks ran before the user's subsequent verification constraint.
- [x] 2. Implement `lib/ahspRabAiServer.ts`, private SQL profiles/RPC, and `/api/ahsp/rab/ai/{status,profiles,run}`. Server behavior is implemented; functional verification is reserved for the user.
- [x] 3. Add PDF/image browser reader and AI import UI: settings editor, page selection, extraction preview, session activity panel. Integrate accepted rows into reconciliation without synthetic Excel provenance.
- [x] 4. Audit UI/UX only for initial screen, JSON editor, empty activity, keyboard dismissal and responsive light/dark layouts. TypeScript/ESLint clean and Webpack build succeeds; Turbopack internal CSS-process error recorded. No functional regression or external model calls.
- [x] 5. Fresh UI/UX review completed; mobile select and stale copy corrected. Setup/limits and the manual migration/credentials boundary documented.

## Progress

2026-10-25: Plan recorded; implementation authorized by user. Logs default to session scope and access to manager scope as announced. No remote AI calls or DB migrations have been performed.

Ruling: user explicitly requested no functional testing after implementation began. All subsequent functional test execution stopped; later validation is UI/UX plus static compilation only. Database/provider/OCR/reconciliation behavior remains for the user's manual testing. Fresh UI reviewer found truncated mobile selectors and stale Excel-only introductory copy; both corrected.
