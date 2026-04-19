# Trackify — Smart Work Tracker

An all-in-one collaborative workspace to plan, track, and ship work faster — installable as a PWA on Android, iOS, and desktop. Built with Next.js 14, Supabase, and Tailwind CSS.

## Features

- **Today surface** — Stats strip (streak, focus minutes, week score), quick-capture with natural-language time parsing, focus tasks, today's events + reminders, today's work-log
- **Global quick-capture FAB** — Keyboard shortcut `C`. Type "call supplier 3pm tomorrow" → reminder. Type "meeting with Alice Thursday" → calendar event. Type anything else → task. Live parse preview + 3-way override + recent-captures CRUD
- **Work Entries** — Daily logs with productivity scores, hours worked, mood, tags, photo proof
- **Task Management** — Priorities, due dates, subtasks, dependencies, labels, kanban or list view
- **Kanban Boards** — Drag-and-drop columns + cards, per-column colors, inline edit, rename/delete
- **Rich Notes** — Notion-like block editor (BlockNote) with real-time CRDT collab via Yjs, page hierarchy, templates
- **Smart Mindmap** — Auto-builds from your tasks / reminders / entries / pages with FK edges (parent-child, task-reminder, same-board, shared-tag) + TF-IDF keyword links. Date-window filter, title search, color-by kind/urgency/status/priority, overview bar, actionable suggestion sidebar (batched + ranked). Embedded at the top of `/mindmaps`, collapsible
- **User Mindmaps** — Manual ReactFlow canvases with real-time Yjs collab
- **Drawings** — Excalidraw canvas with Yjs collab + scene-space cursor overlay
- **Calendar + Bookings** — Events, deadlines, resource bookings with edit-notes
- **Reminders** — Push notifications with 3-strike retry, IST-correct delivery, edit-after-creation, per-user privacy
- **Challenges** — 21-day style habit / roadmap / daily-task challenges with progress tracking
- **Personal space** — Private lane inside shared workspaces. Mark any task / entry / board / note / reminder private and it hides from teammates
- **Analytics & Reports** — Charts, heatmaps, productivity trends. Export to PDF / Word / Excel
- **Collaboration** — Comments, @mentions, real-time presence, share links (login-gated + privacy-gated), workspace-wide editor access (teammates can edit each other's non-private items), author badges on shared tasks
- **User preferences** — Landing page, list density, accent color (6 palettes), default tasks/calendar view, FAB visibility — `/settings/preferences`
- **Admin dashboard** — User management, whitelist (approve + reject requests), email broadcasts with PWA install steps, per-user activity + notifications + feedback, share-link audit
- **Notifications** — Grouped by date bucket, per-type filter, bulk "clear read"
- **PWA** — Installable on Android (Chrome/Edge), iOS (Safari 16.4+), and desktop. Invite emails include step-by-step install instructions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, Server Components) |
| Language | TypeScript |
| Database | Supabase (Postgres + RLS + Realtime) |
| Auth | Supabase Auth (email/password, whitelist-gated) |
| Styling | Tailwind CSS 3 + Radix UI |
| Rich Editor | BlockNote |
| Canvas | Excalidraw |
| Mind Maps | ReactFlow + ELK.js (hierarchical layout) |
| CRDT Collab | Yjs + y-protocols (Supabase-broadcast transport, no new server) |
| Charts | Recharts |
| Drag & Drop | @dnd-kit |
| Animations | Framer Motion |
| Email | Resend (optional) |
| Push | web-push (VAPID) |
| Deployment | Vercel |

## Setup

### 1. Install

```bash
npm install
```

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (server-only) |
| `NEXT_PUBLIC_APP_URL` | Yes | Your deployed URL (for email links + PWA) |
| `CRON_SECRET` | Yes | Random string for cron auth |
| `RESEND_API_KEY` | No | Transactional email — graceful no-op if missing |
| `RESEND_FROM_EMAIL` | No | Sender email |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | Web push public key |
| `VAPID_PRIVATE_KEY` | No | Web push private key (server-only) |
| `VAPID_SUBJECT` | No | Contact email for push provider |
| `ADMIN_EMAIL` | No | Email granted admin dashboard access |

### 3. Database

Run migrations in numeric order. Supabase SQL Editor works:

1. `supabase/migrations/ALL_MIGRATIONS_COMBINED.sql` (covers 001–028)
2. Then in order: `029`, `030`, `031`, `032`, `033`, `034`, `035`

### 4. Whitelist your email

```sql
INSERT INTO public.email_whitelist (email) VALUES ('you@example.com');
```

### 5. Run

```bash
npm run dev
```

## Deploy to Vercel

1. Push to GitHub
2. Import in [Vercel](https://vercel.com)
3. Set environment variables (see table above)
4. Add a Cron entry for `/api/cron/send-reminder-pushes` (every minute recommended — the cron is idempotent and has a 3-strike retry ceiling)
5. Deploy

## Security Notes

- Row Level Security (RLS) on every table, scoped to workspaces
- Role hierarchy: owner > admin > editor > viewer — enforced via `user_has_workspace_access()`
- **Personal lane**: items flagged `is_private = true` stay owner-only even inside shared workspaces
- **Share links** (`/shared/[token]`): login-gated, privacy-gated (private items refused at both creation and viewer API), field-filtered API response, workspace-wide audit + revoke at `/workspace/shared-links`
- **Reminders are per-user** — push + notifications never leak to teammates
- **IST-correct datetime** throughout — Vercel servers interpret user input as IST, not UTC
- Admin dashboard restricted by `ADMIN_EMAIL` env var
- Cron endpoint protected by Bearer `CRON_SECRET`
- Service role key server-side only (used for cron + share-link API only)

## Scripts

```bash
npm run dev      # Dev server on :3000
npm run build    # Production build
npm run start    # Serve production build
npm run lint     # next lint
npx tsc --noEmit # Type check — de-facto test gate
```
