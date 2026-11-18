# Suite admin, Office recovery, and theme implementation plan

**Goal:** Add suite user management, diagnose Office setup failure, and improve the four applications in light/dark themes without browser tests.

**Architecture:** Existing Supabase Auth plus service-only application roles/RPCs. Separate suite-admin authority from template administration and workspace membership. Reuse CSS Modules and native controls; no new runtime dependencies. Keep FinTrack and unrelated AHSP changes outside this work.

**Accepted direction:** User requested user management, Office repair, dark mode, superior-ui-audit and apple-design. Use calm system typography, clear hierarchy, instant press feedback, restrained translucent toolbar, visible focus, reduced-motion/transparency alternatives. ENERGY 1 / RHYTHM 2 / MOTION 1. Theme preference is local to the suite and persists as light/dark/system.

## Evidence and audit before edits

Surface: suite shell, Office task/detail, Documents public/editor/admin, Deployments/Monitoring. Governing evidence: the user's Apple-style/theme request and shared control contracts. DESIGN.md explicitly scopes its portfolio typography/palette to `/` and `/menu`; tools are an exception. No rendered/browser claims in this audit.

| # | Observation | Evidence and connection | Correction | Reach | Confidence |
|---|---|---|---|---|---|
| 1 | Theme cannot change: `.page` fixes light color-scheme, background and controls. | `app/tools/tools.module.css` reaches shell; `app/documents/documents.module.css` reaches public/editor/admin. | Shared semantic light/dark tokens and persistent theme selector on both shells. | Four apps | High, source |
| 2 | Office detail controls keep white/blue surfaces even if parent theme changes. | `app/office/office.module.css` sets hardcoded `.item`, `.selected`, `.readonly`, `.caption`. | Consume parent semantic colors, including selected and muted states. | Four Office submenus | High, source |
| 3 | Long English module names and account controls share a dense wrapping header. | `ToolsShell` renders four long nav labels and workspace/logout in one row. | Group account actions, show concise Indonesian nav labels and selected state. | Authenticated suite | High, source |
| 4 | Quill toolbar/editor do not inherit all theme colors. | Documents CSS owns `.quill-compact`; Quill snow CSS fixes icon/tooltip surfaces. | Add scoped editor/icon/tooltip theme styles and solid high-contrast focus. | Documents editor | High, source |
| 5 | Most buttons lack press/busy semantics beyond a disabled state. | Shared controls have no active feedback; shell logout uses alert only. | Immediate `:active` feedback and inline pending/error status; respect reduced motion. | Shared shell/controls | High, source |

Highest leverage: semantic tokens shared by both shells. This is an implementation request; the audit's read-only phase ends before source edits below.

## Tasks

- [x] Add failing tests for suite admin authorization, create/update/disable roles, self-lockout protection, and disabled/legacy bootstrap handling; SQL enforces last-active-admin protection.
- [x] Add migration 005, guarded user-management APIs/page, and bootstrap context. New users remain non-admin; disabled suite accounts are denied independently of FinTrack.
- [x] Verify Office RPC signature/schema through read-only API. Initial missing tables/RPC reproduced; user applied prepared activation SQL, then all five Office read types succeeded for both accounts.
- [x] Add persistent theme owner and semantic CSS tokens; improve shared shell, Office and Documents including Quill. Preference and component tests passed without a browser; visual rendering remains explicitly unverified.
- [x] Run affected behavior tests, local PostgreSQL checks, typecheck, scoped lint and Webpack production build. Fresh read-only review found no confirmed important defects. Recorded verification/limits in the implementation timeline. No browser tests or unrelated changes.

## User-management contract

Suite admin: list/search registered suite profiles, create email/password accounts, edit display name, assign suite/template admin separately, activate/deactivate suite access. No permanent delete or changing another account's password/email in this iteration. User creation never overwrites an existing Auth identity. Profile failures after Auth creation are reported as partial and can be recovered by signing in. SQL serializes permission changes and forbids self-lockout/removal of the last active suite admin.

## Remote boundary

The session has a service-role API key, but no SQL connection/management credential. User ran the prepared activation SQL in SQL Editor and the API verification succeeded. No example PINs were seeded or credentials exposed in source/output.
