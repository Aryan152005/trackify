# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev        # Start dev server on localhost:3000
npm run build      # Production build
npm run start      # Run production build
npm run lint       # ESLint
```

No test framework is configured yet.

## Architecture

**WIS (Work Intelligence System)** — a collaborative Notion-like productivity platform built with Next.js 14 + Supabase + Tailwind. Multi-user workspaces with Kanban boards, block-based notes, task management, and more.

### Tech Stack
- Next.js 14 (App Router, Server Components) + React 18 + TypeScript
- Supabase (Auth, Postgres with RLS, Storage, Realtime)
- TailwindCSS 3 + Radix UI primitives + Lucide icons
- Framer Motion (animations), @dnd-kit (drag and drop)
- BlockNote (Notion-like block editor) + Mantine (BlockNote's UI dependency)
- Recharts (analytics), ReactFlow (mind maps/workflow)
- Resend (transactional email), Vercel Cron (daily reminders)
- Export: docx, jspdf, exceljs for report generation

### Multi-Tenant Workspace Model
All data is scoped to workspaces. The `workspace_id` column exists on all data tables. RLS policies use `user_has_workspace_access(ws_id, min_role)` helper function with roles: owner > admin > editor > viewer.

- `src/lib/workspace/context.tsx` — WorkspaceProvider (client-side, cookie-based active workspace)
- `src/lib/workspace/hooks.ts` — useWorkspace(), useWorkspaceId(), useWorkspaceRole(), useRequireRole()
- `src/lib/workspace/actions.ts` — Server actions for workspace CRUD, invitations, members

### Route Structure
- `src/app/(main)/` — Protected routes wrapped with WorkspaceProvider + AppNav
  - `dashboard/` — Main dashboard with widgets
  - `entries/` — Work entries CRUD
  - `tasks/` — Task management (list view)
  - `boards/` — Kanban boards with drag-and-drop
  - `notes/` — Block-based notes editor (Notion-like)
  - `reminders/` — Reminder management
  - `analytics/` — Charts and analytics
  - `reports/` — Export (DOCX/PDF/Excel)
  - `workspace/` — Workspace settings + member management
- `src/app/api/` — Route handlers: auth, cron, workspace invitations
- `src/app/login/`, `signup/`, `onboarding/` — Public auth pages

### Supabase Client Pattern (important)
Three distinct clients for different contexts:
- `@/lib/supabase/client` — browser-side (`createClient()`)
- `@/lib/supabase/server` — server components/actions (`createClient()` with cookie access)
- `@/lib/supabase/admin` — API routes only (`createAdminClient()`, bypasses RLS)

### Database
Migrations in `supabase/migrations/` (001-009). All tables use Row Level Security scoped to workspaces.

Key tables: `workspaces`, `workspace_members`, `workspace_invitations`, `work_entries`, `tasks`, `boards`, `board_columns`, `pages`, `tags`, `entry_tags`, `attachments`, `reminders`, `timer_sessions`, `daily_motivations`, `user_profiles`, `habits`, `goals`.

### Key Directories
- `src/components/ui/` — Reusable UI primitives (Button, Card, AnimatedLayout, transitions)
- `src/components/boards/` — Kanban board components (kanban-board, column, card, etc.)
- `src/components/notes/` — Notes editor components (block-editor, page-sidebar, page-header)
- `src/components/dashboard/`, `analytics/`, `tasks/` — Feature-specific components
- `src/lib/boards/actions.ts` — Board server actions
- `src/lib/notes/actions.ts` — Notes server actions
- `src/lib/reports/` — DOCX, PDF, Excel export generators
- `src/lib/types/` — TypeScript interfaces (database.ts, workspace.ts, board.ts, page.ts)

### Path Alias
`@/*` maps to `src/*` (configured in tsconfig.json).

### Environment Variables
Requires: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`.
