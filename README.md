# Trackify — Smart Work Tracker

An all-in-one collaborative workspace to plan, track, and ship work faster. Built with Next.js 14, Supabase, and Tailwind CSS.

## Features

- **Work Entries** — Daily work logs with productivity scores, photo proof, tags
- **Task Management** — Tasks with priorities, due dates, status tracking
- **Kanban Boards** — Visual drag-and-drop boards with columns and cards
- **Rich Notes** — Notion-like block editor with templates (meeting notes, project briefs)
- **Mind Maps** — Visual node graphs with ReactFlow
- **Drawings** — Freeform canvas with tldraw
- **Calendar** — Events, deadlines, and reminders in one view
- **Reminders** — Push notifications on Android/desktop PWA
- **Analytics** — Charts, trends, heatmaps, productivity insights
- **Reports** — Export to PDF, Word (DOCX), and Excel
- **Collaboration** — Comments, @mentions, share links, real-time presence
- **Admin Dashboard** — User management, whitelist, email broadcasts, analytics
- **PWA** — Installable on phone and desktop from Chrome

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, Server Components) |
| Language | TypeScript |
| Database | Supabase (Postgres + RLS + Realtime) |
| Auth | Supabase Auth (email/password, whitelist-gated) |
| Styling | Tailwind CSS 3 + Radix UI |
| Rich Editor | BlockNote |
| Canvas | tldraw |
| Mind Maps | ReactFlow |
| Charts | Recharts |
| Drag & Drop | @dnd-kit |
| Animations | Framer Motion |
| Email | Resend |
| Deployment | Vercel |

## Setup

### 1. Install

```bash
npm install
```

### 2. Environment

```bash
cp .env.example .env.local
# Fill in Supabase URL, keys, and app URL
```

### 3. Database

Run all SQL migrations (001-017) in Supabase SQL Editor, or use `supabase/migrations/ALL_MIGRATIONS_COMBINED.sql` followed by `017_feedback_whitelist_requests.sql`.

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
3. Set environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (server-only) |
| `NEXT_PUBLIC_APP_URL` | Yes | Your Vercel URL |
| `CRON_SECRET` | Yes | Random string for cron auth |
| `RESEND_API_KEY` | Optional | For email features |
| `RESEND_FROM_EMAIL` | Optional | Sender email |

4. Deploy

## Security

- Row Level Security (RLS) on all tables, scoped to workspaces
- Role hierarchy: owner > admin > editor > viewer
- Admin dashboard restricted by email
- Cron endpoint protected by Bearer token
- Service role key server-side only

## Scripts

```bash
npm run dev      # Dev server
npm run build    # Production build
npm run start    # Serve production build
npm run lint     # ESLint
```
