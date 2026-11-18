# Office Suite Implementation Plan

> **For agentic workers:** Execute tasks against this plan and the accepted PRD. Track completed steps with checkboxes. Independent domains may run in parallel after the shared interfaces below are fixed.

**Goal:** Implement the four application entries, four Office submenus, shared account access, and Documents access by organizational tag PIN.

**Architecture:** Existing Next.js App Router, Supabase Auth/Postgres/private Storage, raw supabase-js. Shared suite sessions use a dedicated cookie namespace; FinTrack stays separate. Feature APIs validate and authorize in the server; durable multi-write operations use SQL functions. No new runtime dependencies.

**Tech Stack:** Next.js 16.3.4, React 19, TypeScript, Zod, Supabase, jose, bcryptjs, PizZip, Docxtemplater, CSS Modules.

**Spec:** [PRD](../../office-suite-prd.md), [UX](../../office-suite-ux.md), [logic](../../office-suite-logic.md).

## Global constraints

- Preserve unrelated AHSP changes in this shared checkout; no reset, branch switching, committing unrelated files, or production schema execution.
- Indonesian UI, exactly four added application cards and four Office submenus. No placeholder controls.
- Documents anonymous visitors use a PIN per access tag, never a global PIN or one PIN per document.
- Login alone does not unlock Documents except for authorized template admins.
- New SQL files are manually applied in filename order. Prepare deployment/bootstrap instructions and closed failure behavior until configured.
- Preserve Surat Tugas/Perjadin form features, legacy URLs, and protected `/api/generate`.
- Use existing app patterns and installed dependencies. Read installed Next.js docs before code.
- Default PRD proposals apply unless user changes them. Visual antislop mode is pending; backend can progress independently.

## Shared contracts and ownership

Root owns `lib/tools/*`, `app/tools/*`, `app/api/tools/*`, suite CSS/shell/client helpers, auth migration `202610260001_tools.sql`, menu integration, and Documents backend/migration/import.

`lib/tools/server.ts` exports:
- `ToolsError(status: number, message: string, code?: string)`.
- `getToolsContext(request?: Request, options?: { write?: boolean; templateAdmin?: boolean }): Promise<ToolsContext>`.
- `toolsRoute(request: Request, action: () => Promise<Response>): Promise<Response>` validates same-origin mutation, translates errors safely, and sets private/no-store.
- `toolsJson(data: unknown, status?: number): Response`.

`ToolsContext` in `lib/tools/types.ts`: `userId`, `email`, `name`, `workspaceId`, `role` (`owner|admin|member|viewer`), `isTemplateAdmin`, `workspaces` (`{id,name,role}[]`). Selected workspace comes from `workspace` query parameter or `x-tools-workspace` header; default personal workspace.

`lib/tools/client.ts`: `toolsRequest<T>(url: string, init?: RequestInit): Promise<T>` parses JSON, throws `Error` with safe message/status; `useTools()` hook provides `{ context, workspaceId, setWorkspaceId, loading, error, reload }`. Workspace is sent using `x-tools-workspace` by callers.

`app/tools/components/tools-shell.tsx`: `ToolsShell({title, description?, children, section?:'office'|'deployments'|'monitoring'|'documents', tools?: ReturnType<typeof useTools>})`. If `tools` is supplied displays auth/workspace/logout states; Documents public gate can omit it. Office nav exactly tasks/followups/meetings/knowledge.

Shared CSS `app/tools/tools.module.css` exports page/container/header/nav/panel/row/grid/field/input/button/secondary/danger/error/notice/muted/list/table/actions/empty/label. Reuse rather than edit global CSS.

Agent Office owns `app/office/**`, `app/api/office/**`, `lib/office/**`, `scripts/test-office-*.mjs`, `supabase/migrations/202610260003_office.sql`.

Agent Operations owns `app/deployments/**`, `app/monitoring/**`, `app/api/deployments/**`, `app/api/monitoring/**`, `lib/operations/**`, `scripts/*operations*`, `supabase/migrations/202610260004_operations.sql`.

Agent Documents UI owns `app/documents/**` (except old generator business rules must remain), `scripts/test-documents-ui*`. Root owns `lib/documents/**`, `/api/documents/**`, `/api/generate`, `202610260002_documents.sql`, seed/setup scripts, shared auth. Coordinate API shape before client changes.

## Review focus

1. Every alternate URL/API, Supabase anonymous table query and file path must enforce the tag, not just hide UI. Documents tests own this.
2. FinTrack OAuth global sign-out must not invalidate suite refresh tokens. Auth tests and manual lifecycle walkthrough own this.
3. Retry and concurrency in publish/action-item conversion/worker results cannot create duplicate active state. Domain checks and SQL constraints own this.
4. Private notes, counts, search snippets, notifications and old revisions cannot leak to another workspace/member. Office tests own this.
5. Monitoring must reject internal/metadata targets and stale/out-of-order results rather than claim health. Operations tests own this.

## Task 1: Suite account, workspace, shell and SQL boundary

- [ ] Write and run failing checks for safe return paths, role boundaries, isolated session keys, and bootstrap contract.
- [ ] Implement shared contracts above, auth handlers/pages, workspace bootstrap/invites, dedicated Supabase clients, and non-destructive SQL.
- [ ] Verify real helper behavior, relevant existing FinTrack tests, lint/typecheck. Do not execute remote migration.

## Task 2: Documents tag grants and admin template lifecycle

- [ ] Write and run failing checks for tag PIN lookup, zero-prefix/length, grant revocation, direct API denial, file/form validation, and publish conflicts.
- [ ] Implement hash/HMAC lookup, jose grant, shared DB limiter, protected catalog/detail/render, admin tags/templates/versioning, private files, import of two old generators.
- [ ] Update public/admin Documents UI and legacy editor to protected API and version-aware generation.
- [ ] Verify tests, legacy behavior and closed configuration failure. Provide operator bootstrap/migration commands with no embedded PIN/admin email.

## Task 3: Office domain

- [ ] Write and run failing behavior checks for one task domain, followup closure, private scope, conversion deduplication and reporting.
- [ ] Implement SQL, APIs, four functional submenus, attachments, reminders, meetings/export and KB/history/search.
- [ ] Verify task/followup/meeting/KB normal and unauthorized paths. No fake rows or dead actions.

## Task 4: Change Tracker and Monitoring

- [ ] Write and run failing checks for recording-only change operations, safe URL resolution, result ordering, uptime coverage and notification dedupe.
- [ ] Implement shared inventory, CRUD/timelines/rollback records, monitor configuration/history/TLS, authenticated scheduled worker and reminders.
- [ ] Verify worker through deterministic upstream simulation and document scheduler/network prerequisites.

## Task 5: Integration and delivery

- [ ] Add exactly four menu entries, synchronize guides and implementation record, and preserve unrelated edits.
- [ ] Run all new feature checks, applicable legacy tests, typecheck/lint/build, browser walkthrough at narrow/wide sizes where available.
- [ ] Fresh independent review, fix actionable defects with focused failing tests, record unverified remote rollout requirements.
- [ ] Report only verified completion, with migration/admin/secret/worker setup steps and any remaining blockers.

## Execution ledger

- 2026-10-26: User approved PRD implementation. Work in current checkout to preserve approved untracked specs and concurrent AHSP work; no additional worktree/branch mutation. Native root integration plus independently owned domain tasks follows dispatching-parallel-agents. This is not authorization to apply migrations to a shared Supabase project.
