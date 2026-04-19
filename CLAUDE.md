# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## Build & Development Commands

```bash
npm run dev        # Start dev server on localhost:3000
npm run build      # Production build
npm run start      # Run production build
npm run lint       # next lint
npx tsc --noEmit   # Type-check — the standard pre-commit gate (ALWAYS run before commit)
```

No test framework configured. Type-checking via `tsc --noEmit` is the main correctness gate.

## Architecture

**Trackify (aka WIS — Work Intelligence System)** — a collaborative productivity platform built with Next.js 14 + Supabase + Tailwind. Multi-user workspaces with daily work entries, tasks, Kanban boards, Notion-like notes, calendar events, bookings, an auto-connecting smart mindmap, user mindmaps, Excalidraw drawings, habit challenges, push reminders, and a per-user personal lane.

### Tech Stack
- Next.js 14 (App Router, Server Components) + React 18 + TypeScript
- Supabase (Auth, Postgres+RLS, Storage, Realtime)
- TailwindCSS 3 + Radix UI + Lucide icons
- Framer Motion, @dnd-kit, sonner
- BlockNote (block editor) + Mantine, Excalidraw (drawings), ReactFlow (mindmaps)
- **Yjs + y-protocols/awareness** for real-time CRDT collab on drawings / mindmaps / notes
- **ELK.js** for the smart-mindmap layered layout
- Recharts (analytics), Resend (email), Vercel Cron (push delivery)
- Export: docx, jspdf, exceljs
- `web-push` for PWA push notifications

### Multi-Tenant Workspace Model
Data is scoped to workspaces via `workspace_id`. RLS uses `user_has_workspace_access(ws_id, min_role)` with roles: owner > admin > editor > viewer.

**Shared vs Personal lane (important):**
- Workspace-scoped tasks / work_entries / boards / pages / mindmaps / drawings are **visible, editable, and deletable by every workspace editor+** (migration 033). Items flipped to `is_private=true` (personal lane) stay owner-only.
- Reminders remain strictly per-user even in shared workspaces — notifications never leak.
- `src/lib/personal/actions.ts` holds private-lane queries. `src/components/personal/private-toggle.tsx` is mounted on task / entry / board / note / reminder detail surfaces — clicking flips `is_private`.

### IST-correct datetime handling (important)
All reminder / task-due / calendar event times are **interpreted and displayed in IST** regardless of runtime timezone. Always use `src/lib/utils/datetime.ts`:
- `istLocalToUtcISO(input)` — convert `<input type="datetime-local">` string to UTC ISO, treating input as IST.
- `istDateTimeToUtcISO(dateStr, timeStr)` — same for `YYYY-MM-DD` + `HH:MM`.
- `utcISOToIstLocalInput(iso)` — the inverse, for pre-filling datetime-local inputs.
- `formatIST(date, opts?)` — format as IST wall-clock, e.g. "Apr 20, 2026 at 9:00 AM".
- `istDateKey(date)` — IST calendar day as `YYYY-MM-DD`.

**Never** write `new Date("2026-04-20T09:00:00").toISOString()` — that interprets as runtime-local. On Vercel (UTC) it silently stores the wrong instant. This caused the original "reminder fires 5h30m late" bug — see migration 030's backfill and `src/lib/tasks/actions.ts:82` for the fix pattern.

### Real-time CRDT collab
`src/lib/collab/` holds a custom Yjs provider using **Supabase broadcast** as transport — no new server. Every drawing / mindmap / notes page has an entity-keyed channel and a binary `yjs_state` BYTEA column on its table (migration 032). The `useYjsDoc({ entity, id })` hook wires load + subscribe + debounced snapshot save. Canvas cursors use **scene coordinates** (`src/components/collaboration/canvas-cursors.tsx`), not screen pixels — pan/zoom on one peer doesn't drag cursors on others.

### Route Structure
- `src/app/(main)/` — Protected routes wrapped with `PreferencesProvider` + `WorkspaceProvider` + `AppNav`
  - `today/` — Primary daily surface: stats strip, quick capture, focus tasks, events, reminders, today's log
  - `dashboard/` — Analytics + widgets (the default login landing unless the user sets a different `landingPage` preference)
  - `tasks/` — Task list. Redirects to `/boards` when `defaultTaskView=board` pref is set; `?view=list` forces the list
  - `boards/`, `notes/`, `entries/`, `reminders/`, `calendar/`, `bookings/`, `drawings/`, `mindmaps/`, `challenges/`, `timeline/`, `analytics/`, `reports/`
  - `mindmaps/` — Smart auto-generated mindmap always rendered at the top (collapsible, persisted in localStorage), user-created mindmaps below. `/mindmaps/smart` redirects here
  - `personal/` — Private lane: `/personal`, `/personal/pages`, `/personal/tasks`, `/personal/entries`, `/personal/boards`, `/personal/reminders`
  - `workspace/` — `/workspace`, `/workspace/members`, `/workspace/activity`, `/workspace/integrations`, `/workspace/shared-links` (audit + revoke)
  - `settings/` — `/settings`, `/settings/profile`, `/settings/preferences` (landing page, density, accent, FAB, default views)
  - `admin/` — Admin-only (email-gated via `ADMIN_EMAIL` env): users list, per-user detail, whitelist, access requests (approve + reject), email composers, feedback, system logs
  - `notifications/` — Grouped by date bucket (Today/Yesterday/Week/Older), per-type filter, bulk "clear read"
- `src/app/api/` — Route handlers: auth, cron (daily reminder + push retry), collaboration share tokens, workspace invite accept, push subscribe, webhooks incoming/outgoing
- `src/app/shared/[token]/` — Read-only preview for share-linked entities (login-gated; workspace members auto-redirect to the in-app editor)
- `src/app/login/`, `signup/`, `onboarding/`, `forgot-password/`, `auth/reset/`, `request-access/`, `auth/callback/` — Public auth flow

### Nav structure
- **Primary nav (3 items)**: Today · Tasks · Notes (+ Explore dropdown holding everything else).
- **Global `+` FAB** on every page under `(main)` — parses typed text (client-side preview via `src/lib/today/parse.ts`), shows live detection, offers 3-way override (task / reminder / event), recent-captures inline CRUD. Keyboard shortcut `C`. Can be hidden via user preference.
- `src/components/app-nav.tsx`, `src/components/today/global-capture-fab.tsx`.

### Supabase Client Pattern (important)
- `@/lib/supabase/client` — browser-side (`createClient()`)
- `@/lib/supabase/server` — server components/actions (cookie-scoped; RLS enforced)
- `@/lib/supabase/admin` — API routes only (`createAdminClient()`, **bypasses RLS**)

Service-role client is only used in `/api/collaboration/share/[token]` (with explicit privacy gate), cron routes, and admin-scoped actions. Everything else prefers the server client + RLS.

### Database Migrations
Migrations in `supabase/migrations/` numbered 001–035. All tables enforce RLS scoped to workspaces.

**Key recent migrations:**
- `013_collaboration.sql` — comments, mentions, shared_links, cursor_positions
- `014_personal_spaces.sql` — `is_private` column on all shareable tables
- `029_user_last_activity.sql` — `user_profiles.last_activity_at` + `touch_user_activity()` RPC
- `030_backfill_ist_reminders.sql` — one-shot fix for wrongly-stored task-auto reminders
- `031_reminder_push_retry.sql` — `reminders.push_attempts` with 3-strike retry ceiling
- `032_yjs_collab_state.sql` — `yjs_state BYTEA` on drawings / mindmaps / pages
- `033_workspace_shared_write.sql` — relaxed UPDATE/DELETE to editor+ with `is_private` owner check
- `034_user_preferences.sql` — `user_profiles.preferences` JSONB
- `035_sharing_security_fixes.sql` — `shared_links.entity_type` CHECK now includes `'challenge'`

Run migrations in numeric order. `ALL_MIGRATIONS_COMBINED.sql` contains 001–028; run 029–035 in sequence afterwards.

**Key tables:** `workspaces`, `workspace_members`, `workspace_invitations`, `work_entries`, `tasks`, `boards`, `board_columns`, `pages`, `tags`, `entry_tags`, `attachments`, `reminders` (incl. `push_attempts`, `notified_at`, `is_private`, `entity_type`, `entity_id`), `timer_sessions`, `daily_motivations`, `user_profiles` (incl. `preferences`, `last_activity_at`), `habits`, `goals`, `mindmaps`, `drawings`, `challenges`, `calendar_events`, `bookings`, `notifications`, `shared_links`, `system_logs`, `whitelist_requests`, `user_feedback`.

### Key Directories
- `src/app/(main)/today/` — Primary daily surface
- `src/components/today/` — `quick-capture.tsx`, `global-capture-fab.tsx`
- `src/lib/today/` — `actions.ts` (quickCapture/delete/rename, getTodaySnapshot, addTodayEntryNote), `parse.ts` (NL parser shared by client preview + server commit)
- `src/lib/utils/datetime.ts` — IST helpers (use these for EVERY reminder/task/calendar time)
- `src/lib/collab/` — `supabase-yjs-provider.ts`, `snapshot-actions.ts`, `use-yjs-doc.ts`
- `src/lib/preferences/` — `types.ts`, `actions.ts` (get/update), `provider.tsx` (context + hook)
- `src/components/preferences/` — `preferences-bootstrap.tsx` (applies density + accent CSS vars on first paint), `preferences-form.tsx`
- `src/lib/smart-mindmap/` — `graph.ts` (builder with FK edges, TF-IDF keywords, overview + suggestions + priority ranking), `actions.ts` (suggestion handlers incl. `archiveStaleTask`, `batchCompleteOverdueReminders`), `text-utils.ts` (tokenizer + TF-IDF)
- `src/lib/email/template.ts` — All outgoing email templates incl. reusable `pwaInstallStepsHtml()` (Android/iOS/Desktop install steps in plain-text-friendly HTML)
- `src/lib/collaboration/sharing-actions.ts` — Share link CRUD + `getWorkspaceSharedLinks` audit + `tableForEntity` mapping helper + privacy gate in `createSharedLink`
- `src/lib/reminders/actions.ts` — Reminder CRUD incl. `createReminderForEntity` (task↔reminder link)
- `src/components/ui/` — Reusable primitives (Button, Card, ConfirmDialog, PageHeader, AnimatedLayout)
- `src/components/personal/` — `personal-sidebar.tsx`, `private-toggle.tsx`
- `src/components/mindmaps/` — `smart-mindmap.tsx` (color-mode dropdown, overview bar, edge-reason tooltip), `smart-mindmap-section.tsx` (collapsible host on `/mindmaps`), `mindmap-canvas.tsx` (user-drawn mindmap with Yjs collab)
- `src/components/collaboration/` — `author-badge.tsx`, `canvas-cursors.tsx`, `cursor-overlay.tsx`, `share-dialog.tsx`, `shared-section.tsx`

### Path Alias
`@/*` maps to `src/*` (configured in tsconfig.json).

### Environment Variables
**Required:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`.
**Optional:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (graceful email-disabled fallback when missing), `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` (for push), `ADMIN_EMAIL` (admin dashboard access — falls back to a hardcoded owner email for dev if unset).

## Conventions to follow

- **IST-first**: never handroll datetime conversions. Always use `lib/utils/datetime`.
- **Privacy**: when serving entity data from a server action or public API route, respect `is_private`. The shared-link API route (`/api/collaboration/share/[token]`) has a dedicated privacy gate — do not bypass.
- **Server-action filters**: for workspace-shared items (tasks, work_entries, boards, pages), do NOT force `.eq("user_id", auth.uid())`. Rely on RLS (`migration 033`) so teammates can act on each other's non-private items.
- **Revalidation**: CRUD on tasks/reminders/entries should `revalidatePath("/mindmaps")` and `revalidatePath("/today")` so derived views stay fresh. See `src/lib/tasks/actions.ts` for the pattern.
- **Confirm destructive actions**: use the `ConfirmDialog` component (`src/components/ui/confirm-dialog.tsx`), never `window.confirm()` / `window.prompt()`. The only remaining prompt is the type-to-confirm workspace delete, which is intentional.
- **Mobile dialogs**: any Radix `Dialog.Content` should include class `sheet-on-mobile` — on ≤640px it slides up from the bottom as a sheet (defined in `src/app/globals.css`).
- **Skeletons**: use the `.skeleton` CSS class for shimmering placeholders; route-level loaders live in `loading.tsx` next to each page.
- **User preferences**: read via `usePreferences()` hook; write via `updateUserPreferences(patch)` server action which merges (read-modify-write to avoid wiping unknown keys).
- **Email templates**: all live in `src/lib/email/template.ts`. When building a first-touch email (welcome / whitelist-approved / invite), include the `pwaInstallStepsHtml()` block.
