-- Combined migrations for WIS (Work Intelligence System)
-- Run this in Supabase SQL Editor

-- ============================================
-- Migration: 001_initial_schema.sql
-- ============================================
-- WIS (Work Intelligence System) – Initial schema
-- Run this in Supabase Dashboard → SQL Editor → New query, then Run.
-- This migration is idempotent: safe to run multiple times.

-- =============================================================================
-- 1. work_entries
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.work_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  work_done TEXT,
  learning TEXT,
  next_day_plan TEXT,
  mood TEXT,
  productivity_score SMALLINT CHECK (productivity_score >= 1 AND productivity_score <= 10),
  status TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('done', 'in-progress', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_entries_user_id ON public.work_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_work_entries_date ON public.work_entries(date);
CREATE INDEX IF NOT EXISTS idx_work_entries_user_date ON public.work_entries(user_id, date);

-- =============================================================================
-- 2. tags
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6366f1'
);

-- =============================================================================
-- 3. entry_tags (many-to-many)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.entry_tags (
  entry_id UUID NOT NULL REFERENCES public.work_entries(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_entry_tags_entry_id ON public.entry_tags(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_tags_tag_id ON public.entry_tags(tag_id);

-- =============================================================================
-- 4. attachments
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.work_entries(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'pdf', 'doc'))
);

CREATE INDEX IF NOT EXISTS idx_attachments_entry_id ON public.attachments(entry_id);

-- =============================================================================
-- 5. email_whitelist (for passwordless auth)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.email_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_whitelist_email ON public.email_whitelist(email);

-- =============================================================================
-- 6. holidays (global + per-user later if needed)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'public' CHECK (type IN ('public', 'personal'))
);

CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays(date);

-- =============================================================================
-- 7. Row Level Security (RLS) - Enable RLS
-- =============================================================================
ALTER TABLE public.work_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 8. RLS Policies (idempotent: drop if exists, then create)
-- =============================================================================

-- work_entries: user sees only their own
DROP POLICY IF EXISTS "Users can CRUD own work_entries" ON public.work_entries;
CREATE POLICY "Users can CRUD own work_entries"
  ON public.work_entries
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- tags: readable by all authenticated; insert/update/delete can be restricted later
DROP POLICY IF EXISTS "Authenticated users can read tags" ON public.tags;
CREATE POLICY "Authenticated users can read tags"
  ON public.tags
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert tags" ON public.tags;
CREATE POLICY "Authenticated users can insert tags"
  ON public.tags
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update tags" ON public.tags;
CREATE POLICY "Authenticated users can update tags"
  ON public.tags
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- entry_tags: only for entries owned by user
DROP POLICY IF EXISTS "Users can manage entry_tags for own entries" ON public.entry_tags;
CREATE POLICY "Users can manage entry_tags for own entries"
  ON public.entry_tags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.work_entries e
      WHERE e.id = entry_tags.entry_id AND e.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.work_entries e
      WHERE e.id = entry_tags.entry_id AND e.user_id = auth.uid()
    )
  );

-- attachments: only for entries owned by user
DROP POLICY IF EXISTS "Users can manage attachments for own entries" ON public.attachments;
CREATE POLICY "Users can manage attachments for own entries"
  ON public.attachments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.work_entries e
      WHERE e.id = attachments.entry_id AND e.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.work_entries e
      WHERE e.id = attachments.entry_id AND e.user_id = auth.uid()
    )
  );

-- email_whitelist: readable by all authenticated (for checking), but only admins/service role can insert
DROP POLICY IF EXISTS "Authenticated users can read email_whitelist" ON public.email_whitelist;
CREATE POLICY "Authenticated users can read email_whitelist"
  ON public.email_whitelist
  FOR SELECT
  TO authenticated
  USING (true);

-- holidays: readable by all (shared calendar); restrict write if you want
DROP POLICY IF EXISTS "Anyone can read holidays" ON public.holidays;
CREATE POLICY "Anyone can read holidays"
  ON public.holidays
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage holidays" ON public.holidays;
CREATE POLICY "Authenticated users can manage holidays"
  ON public.holidays
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- ============================================
-- Migration: 002_seed_tags.sql
-- ============================================
-- Optional: seed a few tags so "Add entry" form has tags to select.
-- Run in Supabase SQL Editor after 001_initial_schema.sql.

INSERT INTO public.tags (name, color) VALUES
  ('Frontend', '#3b82f6'),
  ('Backend', '#22c55e'),
  ('Learning', '#eab308'),
  ('Meeting', '#a855f7'),
  ('Documentation', '#f97316')
ON CONFLICT (name) DO NOTHING;


-- ============================================
-- Migration: 003_seed_whitelist.sql
-- ============================================
-- Optional: seed email whitelist. Use LOWERCASE emails only (login normalizes to lowercase).
-- Run in Supabase SQL Editor after 001_initial_schema.sql.

INSERT INTO public.email_whitelist (email) VALUES
  ('paratakkearyan@gmail.com'),
  ('admin@example.com'),
  ('user@example.com')
ON CONFLICT (email) DO NOTHING;

-- To add more emails later (always use lowercase):
-- INSERT INTO public.email_whitelist (email) VALUES ('yourname@example.com') ON CONFLICT (email) DO NOTHING;


-- ============================================
-- Migration: 004_phase2_features.sql
-- ============================================
-- Phase 2+ Features: User profiles, tasks, reminders, timer, motivation
-- Run after 001_initial_schema.sql

-- =============================================================================
-- 1. user_profiles (name, avatar, preferences)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  theme_preference TEXT DEFAULT 'system' CHECK (theme_preference IN ('light', 'dark', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);

-- =============================================================================
-- 2. tasks (scheduled tasks with done/pending status)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  due_time TIME,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'done', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON public.tasks(user_id, status);

-- =============================================================================
-- 3. reminders
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  reminder_time TIMESTAMPTZ NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern TEXT, -- e.g., 'daily', 'weekly', 'monthly'
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON public.reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_reminder_time ON public.reminders(reminder_time);
CREATE INDEX IF NOT EXISTS idx_reminders_user_time ON public.reminders(user_id, reminder_time);

-- =============================================================================
-- 4. timer_sessions (track work sessions)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.timer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES public.work_entries(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  duration_seconds INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timer_sessions_user_id ON public.timer_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_timer_sessions_started_at ON public.timer_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_timer_sessions_entry_id ON public.timer_sessions(entry_id);

-- =============================================================================
-- 5. daily_motivations (thoughts, quotes, reflections)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.daily_motivations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  quote TEXT,
  reflection TEXT,
  gratitude TEXT,
  mood TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_motivations_user_id ON public.daily_motivations(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_motivations_date ON public.daily_motivations(date);
CREATE INDEX IF NOT EXISTS idx_daily_motivations_user_date ON public.daily_motivations(user_id, date);

-- =============================================================================
-- 6. RLS for new tables
-- =============================================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_motivations ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 7. RLS Policies
-- =============================================================================

-- user_profiles: user sees/updates only their own
DROP POLICY IF EXISTS "Users can CRUD own profile" ON public.user_profiles;
CREATE POLICY "Users can CRUD own profile"
  ON public.user_profiles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- tasks: user sees/manages only their own
DROP POLICY IF EXISTS "Users can CRUD own tasks" ON public.tasks;
CREATE POLICY "Users can CRUD own tasks"
  ON public.tasks
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- reminders: user sees/manages only their own
DROP POLICY IF EXISTS "Users can CRUD own reminders" ON public.reminders;
CREATE POLICY "Users can CRUD own reminders"
  ON public.reminders
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- timer_sessions: user sees/manages only their own
DROP POLICY IF EXISTS "Users can CRUD own timer_sessions" ON public.timer_sessions;
CREATE POLICY "Users can CRUD own timer_sessions"
  ON public.timer_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- daily_motivations: user sees/manages only their own
DROP POLICY IF EXISTS "Users can CRUD own daily_motivations" ON public.daily_motivations;
CREATE POLICY "Users can CRUD own daily_motivations"
  ON public.daily_motivations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- 8. Functions & Triggers
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();


-- ============================================
-- Migration: 005_storage_bucket.sql
-- ============================================
-- Storage bucket for entry attachments (photo proof, etc.)
-- Run in Supabase Dashboard → SQL Editor

-- Create bucket (idempotent: use INSERT with ON CONFLICT or check)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'entry-attachments',
  'entry-attachments',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  file_size_limit = EXCLUDED.file_size_limit;

-- RLS: users can upload/read/delete only in their own folder (user_id/entry_id/file)
-- Policy names are unique to avoid conflicts with other buckets
DROP POLICY IF EXISTS "WIS users upload entry-attachments" ON storage.objects;
CREATE POLICY "WIS users upload entry-attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'entry-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "WIS users read entry-attachments" ON storage.objects;
CREATE POLICY "WIS users read entry-attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'entry-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "WIS users delete entry-attachments" ON storage.objects;
CREATE POLICY "WIS users delete entry-attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'entry-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);


-- ============================================
-- Migration: 006_habits_goals.sql
-- ============================================
-- Additional productivity features: Habits and Goals tracking
-- Run after 004_phase2_features.sql

-- =============================================================================
-- 1. habits (daily habit tracking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  frequency TEXT DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'custom')),
  target_days INTEGER DEFAULT 7, -- per week for weekly habits
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_habits_user_id ON public.habits(user_id);

-- =============================================================================
-- 2. habit_logs (track when habits are completed)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(habit_id, date)
);

CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id ON public.habit_logs(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON public.habit_logs(date);

-- =============================================================================
-- 3. goals (long-term goals with milestones)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON public.goals(status);

-- =============================================================================
-- 4. goal_milestones (break down goals into milestones)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.goal_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_milestones_goal_id ON public.goal_milestones(goal_id);

-- =============================================================================
-- 5. RLS
-- =============================================================================
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_milestones ENABLE ROW LEVEL SECURITY;

-- Habits: user sees/manages only their own
DROP POLICY IF EXISTS "Users can CRUD own habits" ON public.habits;
CREATE POLICY "Users can CRUD own habits"
  ON public.habits
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Habit logs: user sees/manages only for own habits
DROP POLICY IF EXISTS "Users can manage habit_logs for own habits" ON public.habit_logs;
CREATE POLICY "Users can manage habit_logs for own habits"
  ON public.habit_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.habits h
      WHERE h.id = habit_logs.habit_id AND h.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.habits h
      WHERE h.id = habit_logs.habit_id AND h.user_id = auth.uid()
    )
  );

-- Goals: user sees/manages only their own
DROP POLICY IF EXISTS "Users can CRUD own goals" ON public.goals;
CREATE POLICY "Users can CRUD own goals"
  ON public.goals
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Goal milestones: user sees/manages only for own goals
DROP POLICY IF EXISTS "Users can manage goal_milestones for own goals" ON public.goal_milestones;
CREATE POLICY "Users can manage goal_milestones for own goals"
  ON public.goal_milestones
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_milestones.goal_id AND g.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_milestones.goal_id AND g.user_id = auth.uid()
    )
  );

-- =============================================================================
-- 6. Triggers
-- =============================================================================
DROP TRIGGER IF EXISTS update_habits_updated_at ON public.habits;
CREATE TRIGGER update_habits_updated_at
  BEFORE UPDATE ON public.habits
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_goals_updated_at ON public.goals;
CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();


-- ============================================
-- Migration: 007_workspaces_rbac.sql
-- ============================================
-- Workspaces & RBAC: Multi-tenant workspace model
-- Run after 006_habits_goals.sql

-- =============================================================================
-- 1. workspaces
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_personal BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON public.workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_created_by ON public.workspaces(created_by);

-- =============================================================================
-- 2. workspace_members
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);

-- =============================================================================
-- 3. workspace_invitations
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor', 'viewer')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON public.workspace_invitations(token);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON public.workspace_invitations(email);

-- =============================================================================
-- 4. Helper function: check workspace access
-- =============================================================================
CREATE OR REPLACE FUNCTION public.user_has_workspace_access(ws_id UUID, min_role TEXT DEFAULT 'viewer')
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id
    AND user_id = auth.uid()
    AND (
      CASE min_role
        WHEN 'viewer' THEN role IN ('owner', 'admin', 'editor', 'viewer')
        WHEN 'editor' THEN role IN ('owner', 'admin', 'editor')
        WHEN 'admin'  THEN role IN ('owner', 'admin')
        WHEN 'owner'  THEN role = 'owner'
        ELSE false
      END
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================================
-- 5. Add workspace_id to existing tables
-- =============================================================================
ALTER TABLE public.work_entries ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.timer_sessions ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.daily_motivations ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Indexes for workspace_id on all tables
CREATE INDEX IF NOT EXISTS idx_work_entries_workspace ON public.work_entries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON public.tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_reminders_workspace ON public.reminders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_timer_sessions_workspace ON public.timer_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_daily_motivations_workspace ON public.daily_motivations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_habits_workspace ON public.habits(workspace_id);
CREATE INDEX IF NOT EXISTS idx_goals_workspace ON public.goals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tags_workspace ON public.tags(workspace_id);

-- =============================================================================
-- 6. Data migration: create personal workspaces for existing users
-- =============================================================================
-- This creates a personal workspace for each user who has a profile,
-- then backfills workspace_id on all their existing rows.
DO $$
DECLARE
  u RECORD;
  ws_id UUID;
BEGIN
  FOR u IN SELECT user_id, name FROM public.user_profiles LOOP
    -- Create personal workspace
    INSERT INTO public.workspaces (name, slug, created_by, is_personal)
    VALUES (
      u.name || '''s Workspace',
      'personal-' || u.user_id::text,
      u.user_id,
      true
    )
    ON CONFLICT (slug) DO NOTHING
    RETURNING id INTO ws_id;

    -- If workspace already existed, fetch its id
    IF ws_id IS NULL THEN
      SELECT id INTO ws_id FROM public.workspaces WHERE slug = 'personal-' || u.user_id::text;
    END IF;

    -- Add user as owner
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (ws_id, u.user_id, 'owner')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;

    -- Backfill workspace_id on all user's data
    UPDATE public.work_entries SET workspace_id = ws_id WHERE user_id = u.user_id AND workspace_id IS NULL;
    UPDATE public.tasks SET workspace_id = ws_id WHERE user_id = u.user_id AND workspace_id IS NULL;
    UPDATE public.reminders SET workspace_id = ws_id WHERE user_id = u.user_id AND workspace_id IS NULL;
    UPDATE public.timer_sessions SET workspace_id = ws_id WHERE user_id = u.user_id AND workspace_id IS NULL;
    UPDATE public.daily_motivations SET workspace_id = ws_id WHERE user_id = u.user_id AND workspace_id IS NULL;
    UPDATE public.habits SET workspace_id = ws_id WHERE user_id = u.user_id AND workspace_id IS NULL;
    UPDATE public.goals SET workspace_id = ws_id WHERE user_id = u.user_id AND workspace_id IS NULL;
    UPDATE public.tags SET workspace_id = ws_id WHERE workspace_id IS NULL;
  END LOOP;
END $$;

-- =============================================================================
-- 7. RLS for new tables
-- =============================================================================
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Workspaces: members can view, owners/admins can update
DROP POLICY IF EXISTS "Members can view workspaces" ON public.workspaces;
CREATE POLICY "Members can view workspaces"
  ON public.workspaces FOR SELECT
  USING (public.user_has_workspace_access(id, 'viewer'));

DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON public.workspaces;
CREATE POLICY "Authenticated users can create workspaces"
  ON public.workspaces FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Admins can update workspaces" ON public.workspaces;
CREATE POLICY "Admins can update workspaces"
  ON public.workspaces FOR UPDATE
  USING (public.user_has_workspace_access(id, 'admin'));

DROP POLICY IF EXISTS "Owners can delete workspaces" ON public.workspaces;
CREATE POLICY "Owners can delete workspaces"
  ON public.workspaces FOR DELETE
  USING (public.user_has_workspace_access(id, 'owner'));

-- Workspace members: visible to workspace members, managed by admins
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
CREATE POLICY "Members can view workspace members"
  ON public.workspace_members FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Admins can manage workspace members" ON public.workspace_members;
CREATE POLICY "Admins can manage workspace members"
  ON public.workspace_members FOR ALL
  USING (public.user_has_workspace_access(workspace_id, 'admin'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'admin'));

-- Workspace invitations: visible to admins, creatable by admins
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.workspace_invitations;
CREATE POLICY "Admins can manage invitations"
  ON public.workspace_invitations FOR ALL
  USING (public.user_has_workspace_access(workspace_id, 'admin'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'admin'));

-- Public access to invitations by token (for accepting)
DROP POLICY IF EXISTS "Anyone can read invitations by token" ON public.workspace_invitations;
CREATE POLICY "Anyone can read invitations by token"
  ON public.workspace_invitations FOR SELECT
  TO authenticated
  USING (true);

-- =============================================================================
-- 8. Replace RLS policies on existing tables with workspace-scoped ones
-- =============================================================================

-- work_entries
DROP POLICY IF EXISTS "Users can CRUD own work_entries" ON public.work_entries;
DROP POLICY IF EXISTS "Workspace members can view work_entries" ON public.work_entries;
DROP POLICY IF EXISTS "Workspace editors can insert work_entries" ON public.work_entries;
DROP POLICY IF EXISTS "Workspace editors can update work_entries" ON public.work_entries;
DROP POLICY IF EXISTS "Workspace admins can delete work_entries" ON public.work_entries;

CREATE POLICY "Workspace members can view work_entries"
  ON public.work_entries FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));
CREATE POLICY "Workspace editors can insert work_entries"
  ON public.work_entries FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));
CREATE POLICY "Workspace editors can update work_entries"
  ON public.work_entries FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id, 'editor'));
CREATE POLICY "Workspace admins can delete work_entries"
  ON public.work_entries FOR DELETE
  USING (public.user_has_workspace_access(workspace_id, 'admin'));

-- tasks
DROP POLICY IF EXISTS "Users can CRUD own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Workspace members can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Workspace editors can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Workspace editors can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Workspace admins can delete tasks" ON public.tasks;

CREATE POLICY "Workspace members can view tasks"
  ON public.tasks FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));
CREATE POLICY "Workspace editors can insert tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));
CREATE POLICY "Workspace editors can update tasks"
  ON public.tasks FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id, 'editor'));
CREATE POLICY "Workspace admins can delete tasks"
  ON public.tasks FOR DELETE
  USING (public.user_has_workspace_access(workspace_id, 'admin'));

-- reminders
DROP POLICY IF EXISTS "Users can CRUD own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Workspace members can view reminders" ON public.reminders;
DROP POLICY IF EXISTS "Workspace editors can manage reminders" ON public.reminders;

CREATE POLICY "Workspace members can view reminders"
  ON public.reminders FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));
CREATE POLICY "Workspace editors can manage reminders"
  ON public.reminders FOR ALL
  USING (public.user_has_workspace_access(workspace_id, 'editor'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

-- timer_sessions
DROP POLICY IF EXISTS "Users can CRUD own timer_sessions" ON public.timer_sessions;
DROP POLICY IF EXISTS "Workspace members can view timer_sessions" ON public.timer_sessions;
DROP POLICY IF EXISTS "Workspace editors can manage timer_sessions" ON public.timer_sessions;

CREATE POLICY "Workspace members can view timer_sessions"
  ON public.timer_sessions FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));
CREATE POLICY "Workspace editors can manage timer_sessions"
  ON public.timer_sessions FOR ALL
  USING (public.user_has_workspace_access(workspace_id, 'editor'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

-- daily_motivations
DROP POLICY IF EXISTS "Users can CRUD own daily_motivations" ON public.daily_motivations;
DROP POLICY IF EXISTS "Workspace members can view daily_motivations" ON public.daily_motivations;
DROP POLICY IF EXISTS "Workspace editors can manage daily_motivations" ON public.daily_motivations;

CREATE POLICY "Workspace members can view daily_motivations"
  ON public.daily_motivations FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));
CREATE POLICY "Workspace editors can manage daily_motivations"
  ON public.daily_motivations FOR ALL
  USING (public.user_has_workspace_access(workspace_id, 'editor'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

-- habits
DROP POLICY IF EXISTS "Users can CRUD own habits" ON public.habits;
DROP POLICY IF EXISTS "Workspace members can view habits" ON public.habits;
DROP POLICY IF EXISTS "Workspace editors can manage habits" ON public.habits;

CREATE POLICY "Workspace members can view habits"
  ON public.habits FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));
CREATE POLICY "Workspace editors can manage habits"
  ON public.habits FOR ALL
  USING (public.user_has_workspace_access(workspace_id, 'editor'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

-- goals
DROP POLICY IF EXISTS "Users can CRUD own goals" ON public.goals;
DROP POLICY IF EXISTS "Workspace members can view goals" ON public.goals;
DROP POLICY IF EXISTS "Workspace editors can manage goals" ON public.goals;

CREATE POLICY "Workspace members can view goals"
  ON public.goals FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));
CREATE POLICY "Workspace editors can manage goals"
  ON public.goals FOR ALL
  USING (public.user_has_workspace_access(workspace_id, 'editor'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

-- goal_milestones (access through parent goal's workspace)
DROP POLICY IF EXISTS "Users can manage goal_milestones for own goals" ON public.goal_milestones;
DROP POLICY IF EXISTS "Workspace members can view goal_milestones" ON public.goal_milestones;
DROP POLICY IF EXISTS "Workspace editors can manage goal_milestones" ON public.goal_milestones;

CREATE POLICY "Workspace members can view goal_milestones"
  ON public.goal_milestones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_milestones.goal_id
      AND public.user_has_workspace_access(g.workspace_id, 'viewer')
    )
  );
CREATE POLICY "Workspace editors can manage goal_milestones"
  ON public.goal_milestones FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_milestones.goal_id
      AND public.user_has_workspace_access(g.workspace_id, 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_milestones.goal_id
      AND public.user_has_workspace_access(g.workspace_id, 'editor')
    )
  );

-- habit_logs (access through parent habit's workspace)
DROP POLICY IF EXISTS "Users can manage habit_logs for own habits" ON public.habit_logs;
DROP POLICY IF EXISTS "Workspace members can view habit_logs" ON public.habit_logs;
DROP POLICY IF EXISTS "Workspace editors can manage habit_logs" ON public.habit_logs;

CREATE POLICY "Workspace members can view habit_logs"
  ON public.habit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.habits h
      WHERE h.id = habit_logs.habit_id
      AND public.user_has_workspace_access(h.workspace_id, 'viewer')
    )
  );
CREATE POLICY "Workspace editors can manage habit_logs"
  ON public.habit_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.habits h
      WHERE h.id = habit_logs.habit_id
      AND public.user_has_workspace_access(h.workspace_id, 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.habits h
      WHERE h.id = habit_logs.habit_id
      AND public.user_has_workspace_access(h.workspace_id, 'editor')
    )
  );

-- tags: workspace-scoped
DROP POLICY IF EXISTS "Authenticated users can read tags" ON public.tags;
DROP POLICY IF EXISTS "Authenticated users can insert tags" ON public.tags;
DROP POLICY IF EXISTS "Authenticated users can update tags" ON public.tags;
DROP POLICY IF EXISTS "Workspace members can view tags" ON public.tags;
DROP POLICY IF EXISTS "Workspace editors can manage tags" ON public.tags;

CREATE POLICY "Workspace members can view tags"
  ON public.tags FOR SELECT
  USING (workspace_id IS NULL OR public.user_has_workspace_access(workspace_id, 'viewer'));
CREATE POLICY "Workspace editors can manage tags"
  ON public.tags FOR ALL
  USING (workspace_id IS NULL OR public.user_has_workspace_access(workspace_id, 'editor'))
  WITH CHECK (workspace_id IS NULL OR public.user_has_workspace_access(workspace_id, 'editor'));

-- entry_tags: access through parent entry's workspace
DROP POLICY IF EXISTS "Users can manage entry_tags for own entries" ON public.entry_tags;
DROP POLICY IF EXISTS "Workspace members can view entry_tags" ON public.entry_tags;
DROP POLICY IF EXISTS "Workspace editors can manage entry_tags" ON public.entry_tags;

CREATE POLICY "Workspace members can view entry_tags"
  ON public.entry_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.work_entries e
      WHERE e.id = entry_tags.entry_id
      AND public.user_has_workspace_access(e.workspace_id, 'viewer')
    )
  );
CREATE POLICY "Workspace editors can manage entry_tags"
  ON public.entry_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.work_entries e
      WHERE e.id = entry_tags.entry_id
      AND public.user_has_workspace_access(e.workspace_id, 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.work_entries e
      WHERE e.id = entry_tags.entry_id
      AND public.user_has_workspace_access(e.workspace_id, 'editor')
    )
  );

-- attachments: access through parent entry's workspace
DROP POLICY IF EXISTS "Users can manage attachments for own entries" ON public.attachments;
DROP POLICY IF EXISTS "Workspace members can view attachments" ON public.attachments;
DROP POLICY IF EXISTS "Workspace editors can manage attachments" ON public.attachments;

CREATE POLICY "Workspace members can view attachments"
  ON public.attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.work_entries e
      WHERE e.id = attachments.entry_id
      AND public.user_has_workspace_access(e.workspace_id, 'viewer')
    )
  );
CREATE POLICY "Workspace editors can manage attachments"
  ON public.attachments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.work_entries e
      WHERE e.id = attachments.entry_id
      AND public.user_has_workspace_access(e.workspace_id, 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.work_entries e
      WHERE e.id = attachments.entry_id
      AND public.user_has_workspace_access(e.workspace_id, 'editor')
    )
  );

-- =============================================================================
-- 9. Triggers for updated_at
-- =============================================================================
DROP TRIGGER IF EXISTS update_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();


-- ============================================
-- Migration: 008_kanban_boards.sql
-- ============================================
-- Kanban Boards: board + column + task positioning
-- Run after 007_workspaces_rbac.sql

-- =============================================================================
-- 1. boards
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boards_workspace ON public.boards(workspace_id);

-- =============================================================================
-- 2. board_columns
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.board_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_columns_board ON public.board_columns(board_id);

-- =============================================================================
-- 3. Extend tasks table for board support
-- =============================================================================
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES public.boards(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS column_id UUID REFERENCES public.board_columns(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS labels JSONB DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_tasks_board ON public.tasks(board_id);
CREATE INDEX IF NOT EXISTS idx_tasks_column ON public.tasks(column_id);

-- =============================================================================
-- 4. RLS policies for boards
-- =============================================================================
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace viewers can view boards" ON public.boards;
CREATE POLICY "Workspace viewers can view boards"
  ON public.boards FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Workspace editors can create boards" ON public.boards;
CREATE POLICY "Workspace editors can create boards"
  ON public.boards FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

DROP POLICY IF EXISTS "Workspace editors can update boards" ON public.boards;
CREATE POLICY "Workspace editors can update boards"
  ON public.boards FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id, 'editor'));

DROP POLICY IF EXISTS "Workspace admins can delete boards" ON public.boards;
CREATE POLICY "Workspace admins can delete boards"
  ON public.boards FOR DELETE
  USING (public.user_has_workspace_access(workspace_id, 'admin'));

-- =============================================================================
-- 5. RLS policies for board_columns (through parent board's workspace)
-- =============================================================================
ALTER TABLE public.board_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace viewers can view board_columns" ON public.board_columns;
CREATE POLICY "Workspace viewers can view board_columns"
  ON public.board_columns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.boards b
      WHERE b.id = board_columns.board_id
      AND public.user_has_workspace_access(b.workspace_id, 'viewer')
    )
  );

DROP POLICY IF EXISTS "Workspace editors can create board_columns" ON public.board_columns;
CREATE POLICY "Workspace editors can create board_columns"
  ON public.board_columns FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.boards b
      WHERE b.id = board_columns.board_id
      AND public.user_has_workspace_access(b.workspace_id, 'editor')
    )
  );

DROP POLICY IF EXISTS "Workspace editors can update board_columns" ON public.board_columns;
CREATE POLICY "Workspace editors can update board_columns"
  ON public.board_columns FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.boards b
      WHERE b.id = board_columns.board_id
      AND public.user_has_workspace_access(b.workspace_id, 'editor')
    )
  );

DROP POLICY IF EXISTS "Workspace admins can delete board_columns" ON public.board_columns;
CREATE POLICY "Workspace admins can delete board_columns"
  ON public.board_columns FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.boards b
      WHERE b.id = board_columns.board_id
      AND public.user_has_workspace_access(b.workspace_id, 'admin')
    )
  );

-- =============================================================================
-- 6. updated_at trigger for boards
-- =============================================================================
DROP TRIGGER IF EXISTS update_boards_updated_at ON public.boards;
CREATE TRIGGER update_boards_updated_at
  BEFORE UPDATE ON public.boards
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();


-- ============================================
-- Migration: 009_pages.sql
-- ============================================
-- Pages: Notion-like block-based documents
-- Run after 008_kanban_boards.sql

CREATE TABLE IF NOT EXISTS public.pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  parent_page_id UUID REFERENCES public.pages(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  icon TEXT,
  cover_url TEXT,
  content JSONB DEFAULT '[]',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  last_edited_by UUID REFERENCES auth.users(id),
  is_template BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pages_workspace ON public.pages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pages_parent ON public.pages(parent_page_id);
CREATE INDEX IF NOT EXISTS idx_pages_created_by ON public.pages(created_by);

-- RLS
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace viewers can view pages" ON public.pages;
CREATE POLICY "Workspace viewers can view pages"
  ON public.pages FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Workspace editors can create pages" ON public.pages;
CREATE POLICY "Workspace editors can create pages"
  ON public.pages FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

DROP POLICY IF EXISTS "Workspace editors can update pages" ON public.pages;
CREATE POLICY "Workspace editors can update pages"
  ON public.pages FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id, 'editor'));

DROP POLICY IF EXISTS "Workspace admins can delete pages" ON public.pages;
CREATE POLICY "Workspace admins can delete pages"
  ON public.pages FOR DELETE
  USING (public.user_has_workspace_access(workspace_id, 'admin'));

-- updated_at trigger
DROP TRIGGER IF EXISTS update_pages_updated_at ON public.pages;
CREATE TRIGGER update_pages_updated_at
  BEFORE UPDATE ON public.pages
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();


-- ============================================
-- Migration: 010_mindmaps_activity.sql
-- ============================================
-- Mind maps & Activity log
-- Run after 009_pages.sql

-- =============================================================================
-- 1. mindmaps
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.mindmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Mind Map',
  description TEXT,
  nodes JSONB DEFAULT '[]',
  edges JSONB DEFAULT '[]',
  viewport JSONB DEFAULT '{"x": 0, "y": 0, "zoom": 1}',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mindmaps_workspace ON public.mindmaps(workspace_id);

-- RLS
ALTER TABLE public.mindmaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace viewers can view mindmaps" ON public.mindmaps;
CREATE POLICY "Workspace viewers can view mindmaps"
  ON public.mindmaps FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Workspace editors can create mindmaps" ON public.mindmaps;
CREATE POLICY "Workspace editors can create mindmaps"
  ON public.mindmaps FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

DROP POLICY IF EXISTS "Workspace editors can update mindmaps" ON public.mindmaps;
CREATE POLICY "Workspace editors can update mindmaps"
  ON public.mindmaps FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id, 'editor'));

DROP POLICY IF EXISTS "Workspace admins can delete mindmaps" ON public.mindmaps;
CREATE POLICY "Workspace admins can delete mindmaps"
  ON public.mindmaps FOR DELETE
  USING (public.user_has_workspace_access(workspace_id, 'admin'));

-- updated_at trigger
DROP TRIGGER IF EXISTS update_mindmaps_updated_at ON public.mindmaps;
CREATE TRIGGER update_mindmaps_updated_at
  BEFORE UPDATE ON public.mindmaps
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- =============================================================================
-- 2. activity_log
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  entity_title TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_workspace ON public.activity_log(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON public.activity_log(entity_type, entity_id);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace viewers can view activity_log" ON public.activity_log;
CREATE POLICY "Workspace viewers can view activity_log"
  ON public.activity_log FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Workspace editors can create activity_log" ON public.activity_log;
CREATE POLICY "Workspace editors can create activity_log"
  ON public.activity_log FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));


-- ============================================
-- Migration: 011_notifications_requests.sql
-- ============================================
-- Notifications, Requests & Discord Webhooks
-- Run after 010_mindmaps_activity.sql

-- =============================================================================
-- 1. notifications
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT,
  entity_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications(user_id, is_read, created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Workspace editors can insert notifications" ON public.notifications;
CREATE POLICY "Workspace editors can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

-- =============================================================================
-- 2. requests
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES auth.users(id),
  to_user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL CHECK (type IN ('task', 'review', 'approval', 'info', 'nudge', 'custom')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed')),
  related_entity_type TEXT,
  related_entity_id UUID,
  due_date DATE,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requests_workspace_to_status
  ON public.requests(workspace_id, to_user_id, status);

-- RLS
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view requests" ON public.requests;
CREATE POLICY "Workspace members can view requests"
  ON public.requests FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Workspace editors can create requests" ON public.requests;
CREATE POLICY "Workspace editors can create requests"
  ON public.requests FOR INSERT
  WITH CHECK (
    public.user_has_workspace_access(workspace_id, 'editor')
    AND from_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Request participants can update requests" ON public.requests;
CREATE POLICY "Request participants can update requests"
  ON public.requests FOR UPDATE
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid())
  WITH CHECK (from_user_id = auth.uid() OR to_user_id = auth.uid());

DROP POLICY IF EXISTS "Request creator can delete requests" ON public.requests;
CREATE POLICY "Request creator can delete requests"
  ON public.requests FOR DELETE
  USING (from_user_id = auth.uid());

-- =============================================================================
-- 3. discord_webhooks
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.discord_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.discord_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace viewers can view discord webhooks" ON public.discord_webhooks;
CREATE POLICY "Workspace viewers can view discord webhooks"
  ON public.discord_webhooks FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Workspace admins can create discord webhooks" ON public.discord_webhooks;
CREATE POLICY "Workspace admins can create discord webhooks"
  ON public.discord_webhooks FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'admin'));

DROP POLICY IF EXISTS "Workspace admins can update discord webhooks" ON public.discord_webhooks;
CREATE POLICY "Workspace admins can update discord webhooks"
  ON public.discord_webhooks FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id, 'admin'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'admin'));

DROP POLICY IF EXISTS "Workspace admins can delete discord webhooks" ON public.discord_webhooks;
CREATE POLICY "Workspace admins can delete discord webhooks"
  ON public.discord_webhooks FOR DELETE
  USING (public.user_has_workspace_access(workspace_id, 'admin'));


-- ============================================
-- Migration: 012_calendar_bookings_drawings.sql
-- ============================================
-- Calendar, Bookings & Drawings
-- Run after 011_notifications_requests.sql

-- =============================================================================
-- 1. calendar_events
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  color TEXT DEFAULT '#6366f1',
  recurrence_rule TEXT,
  location TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  related_entity_type TEXT,
  related_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_workspace
  ON public.calendar_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time
  ON public.calendar_events(start_time);

-- RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace viewers can view calendar events" ON public.calendar_events;
CREATE POLICY "Workspace viewers can view calendar events"
  ON public.calendar_events FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Workspace editors can create calendar events" ON public.calendar_events;
CREATE POLICY "Workspace editors can create calendar events"
  ON public.calendar_events FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

DROP POLICY IF EXISTS "Workspace editors can update calendar events" ON public.calendar_events;
CREATE POLICY "Workspace editors can update calendar events"
  ON public.calendar_events FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id, 'editor'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

DROP POLICY IF EXISTS "Workspace admins can delete calendar events" ON public.calendar_events;
CREATE POLICY "Workspace admins can delete calendar events"
  ON public.calendar_events FOR DELETE
  USING (public.user_has_workspace_access(workspace_id, 'admin'));

-- updated_at trigger
DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- =============================================================================
-- 2. calendar_event_attendees
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.calendar_event_attendees (
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'tentative')),
  PRIMARY KEY (event_id, user_id)
);

-- RLS (access through parent event workspace)
ALTER TABLE public.calendar_event_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Attendees viewable by workspace members" ON public.calendar_event_attendees;
CREATE POLICY "Attendees viewable by workspace members"
  ON public.calendar_event_attendees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.calendar_events ce
      WHERE ce.id = event_id
      AND public.user_has_workspace_access(ce.workspace_id, 'viewer')
    )
  );

DROP POLICY IF EXISTS "Workspace editors can manage attendees" ON public.calendar_event_attendees;
CREATE POLICY "Workspace editors can manage attendees"
  ON public.calendar_event_attendees FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.calendar_events ce
      WHERE ce.id = event_id
      AND public.user_has_workspace_access(ce.workspace_id, 'editor')
    )
  );

DROP POLICY IF EXISTS "Workspace editors can update attendees" ON public.calendar_event_attendees;
CREATE POLICY "Workspace editors can update attendees"
  ON public.calendar_event_attendees FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.calendar_events ce
      WHERE ce.id = event_id
      AND public.user_has_workspace_access(ce.workspace_id, 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.calendar_events ce
      WHERE ce.id = event_id
      AND public.user_has_workspace_access(ce.workspace_id, 'editor')
    )
  );

DROP POLICY IF EXISTS "Workspace editors can delete attendees" ON public.calendar_event_attendees;
CREATE POLICY "Workspace editors can delete attendees"
  ON public.calendar_event_attendees FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.calendar_events ce
      WHERE ce.id = event_id
      AND public.user_has_workspace_access(ce.workspace_id, 'editor')
    )
  );

-- =============================================================================
-- 3. bookable_resources
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bookable_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('room', 'equipment', 'person', 'slot')),
  availability JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.bookable_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace viewers can view resources" ON public.bookable_resources;
CREATE POLICY "Workspace viewers can view resources"
  ON public.bookable_resources FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Workspace admins can create resources" ON public.bookable_resources;
CREATE POLICY "Workspace admins can create resources"
  ON public.bookable_resources FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'admin'));

DROP POLICY IF EXISTS "Workspace admins can update resources" ON public.bookable_resources;
CREATE POLICY "Workspace admins can update resources"
  ON public.bookable_resources FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id, 'admin'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'admin'));

DROP POLICY IF EXISTS "Workspace admins can delete resources" ON public.bookable_resources;
CREATE POLICY "Workspace admins can delete resources"
  ON public.bookable_resources FOR DELETE
  USING (public.user_has_workspace_access(workspace_id, 'admin'));

-- =============================================================================
-- 4. bookings
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES public.bookable_resources(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  booked_by UUID NOT NULL REFERENCES auth.users(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace viewers can view bookings" ON public.bookings;
CREATE POLICY "Workspace viewers can view bookings"
  ON public.bookings FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Workspace editors can create bookings" ON public.bookings;
CREATE POLICY "Workspace editors can create bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

DROP POLICY IF EXISTS "Workspace editors can update bookings" ON public.bookings;
CREATE POLICY "Workspace editors can update bookings"
  ON public.bookings FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id, 'editor'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

DROP POLICY IF EXISTS "Workspace admins can delete bookings" ON public.bookings;
CREATE POLICY "Workspace admins can delete bookings"
  ON public.bookings FOR DELETE
  USING (public.user_has_workspace_access(workspace_id, 'admin'));

-- =============================================================================
-- 5. drawings
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Drawing',
  data JSONB NOT NULL DEFAULT '{}',
  thumbnail_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.drawings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace viewers can view drawings" ON public.drawings;
CREATE POLICY "Workspace viewers can view drawings"
  ON public.drawings FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Workspace editors can create drawings" ON public.drawings;
CREATE POLICY "Workspace editors can create drawings"
  ON public.drawings FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

DROP POLICY IF EXISTS "Workspace editors can update drawings" ON public.drawings;
CREATE POLICY "Workspace editors can update drawings"
  ON public.drawings FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id, 'editor'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

DROP POLICY IF EXISTS "Workspace admins can delete drawings" ON public.drawings;
CREATE POLICY "Workspace admins can delete drawings"
  ON public.drawings FOR DELETE
  USING (public.user_has_workspace_access(workspace_id, 'admin'));

-- updated_at trigger
DROP TRIGGER IF EXISTS update_drawings_updated_at ON public.drawings;
CREATE TRIGGER update_drawings_updated_at
  BEFORE UPDATE ON public.drawings
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();


-- ============================================
-- Migration: 013_collaboration.sql
-- ============================================
-- Collaboration: Comments, Mentions, Shared Links, Cursor Positions
-- Run after 012_calendar_bookings_drawings.sql

-- =============================================================================
-- 1. comments — threaded comments on any entity
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('page', 'task', 'board', 'entry', 'drawing', 'mindmap')),
  entity_id UUID NOT NULL,
  parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_entity
  ON public.comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_workspace
  ON public.comments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_comments_user
  ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent
  ON public.comments(parent_comment_id);

-- RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace viewers can view comments" ON public.comments;
CREATE POLICY "Workspace viewers can view comments"
  ON public.comments FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Workspace viewers can create comments" ON public.comments;
CREATE POLICY "Workspace viewers can create comments"
  ON public.comments FOR INSERT
  WITH CHECK (
    public.user_has_workspace_access(workspace_id, 'viewer')
    AND auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Own comments can be updated" ON public.comments;
CREATE POLICY "Own comments can be updated"
  ON public.comments FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Own comments or admins can delete" ON public.comments;
CREATE POLICY "Own comments or admins can delete"
  ON public.comments FOR DELETE
  USING (
    auth.uid() = user_id
    OR public.user_has_workspace_access(workspace_id, 'admin')
  );

-- updated_at trigger
DROP TRIGGER IF EXISTS update_comments_updated_at ON public.comments;
CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- =============================================================================
-- 2. mentions — @mention tracking
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('page', 'task', 'board', 'entry', 'drawing', 'mindmap')),
  entity_id UUID NOT NULL,
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id),
  mentioned_by UUID NOT NULL REFERENCES auth.users(id),
  seen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentions_user_seen
  ON public.mentions(mentioned_user_id, seen);
CREATE INDEX IF NOT EXISTS idx_mentions_workspace
  ON public.mentions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_mentions_comment
  ON public.mentions(comment_id);

-- RLS
ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace viewers can view mentions" ON public.mentions;
CREATE POLICY "Workspace viewers can view mentions"
  ON public.mentions FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Workspace viewers can create mentions" ON public.mentions;
CREATE POLICY "Workspace viewers can create mentions"
  ON public.mentions FOR INSERT
  WITH CHECK (
    public.user_has_workspace_access(workspace_id, 'viewer')
    AND auth.uid() = mentioned_by
  );

DROP POLICY IF EXISTS "Mentioned users can mark seen" ON public.mentions;
CREATE POLICY "Mentioned users can mark seen"
  ON public.mentions FOR UPDATE
  USING (auth.uid() = mentioned_user_id);

DROP POLICY IF EXISTS "Mention creators or admins can delete" ON public.mentions;
CREATE POLICY "Mention creators or admins can delete"
  ON public.mentions FOR DELETE
  USING (
    auth.uid() = mentioned_by
    OR public.user_has_workspace_access(workspace_id, 'admin')
  );

-- =============================================================================
-- 3. shared_links — public sharing with optional password and expiry
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.shared_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('page', 'task', 'board', 'entry', 'drawing', 'mindmap')),
  entity_id UUID NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'comment', 'edit')),
  password_hash TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_links_token
  ON public.shared_links(token);
CREATE INDEX IF NOT EXISTS idx_shared_links_entity
  ON public.shared_links(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_shared_links_workspace
  ON public.shared_links(workspace_id);

-- RLS
ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace viewers can view shared links" ON public.shared_links;
CREATE POLICY "Workspace viewers can view shared links"
  ON public.shared_links FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Workspace editors can create shared links" ON public.shared_links;
CREATE POLICY "Workspace editors can create shared links"
  ON public.shared_links FOR INSERT
  WITH CHECK (
    public.user_has_workspace_access(workspace_id, 'editor')
    AND auth.uid() = created_by
  );

DROP POLICY IF EXISTS "Link creators or admins can update shared links" ON public.shared_links;
CREATE POLICY "Link creators or admins can update shared links"
  ON public.shared_links FOR UPDATE
  USING (
    auth.uid() = created_by
    OR public.user_has_workspace_access(workspace_id, 'admin')
  );

DROP POLICY IF EXISTS "Link creators or admins can delete shared links" ON public.shared_links;
CREATE POLICY "Link creators or admins can delete shared links"
  ON public.shared_links FOR DELETE
  USING (
    auth.uid() = created_by
    OR public.user_has_workspace_access(workspace_id, 'admin')
  );

-- =============================================================================
-- 4. cursor_positions — real-time cursor tracking (ephemeral, stored for recovery)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cursor_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('page', 'task', 'board', 'entry', 'drawing', 'mindmap')),
  entity_id UUID NOT NULL,
  cursor_data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_cursor_positions_entity
  ON public.cursor_positions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_cursor_positions_workspace
  ON public.cursor_positions(workspace_id);

-- RLS
ALTER TABLE public.cursor_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace viewers can view cursor positions" ON public.cursor_positions;
CREATE POLICY "Workspace viewers can view cursor positions"
  ON public.cursor_positions FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Users can insert own cursor position" ON public.cursor_positions;
CREATE POLICY "Users can insert own cursor position"
  ON public.cursor_positions FOR INSERT
  WITH CHECK (
    public.user_has_workspace_access(workspace_id, 'viewer')
    AND auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Users can update own cursor position" ON public.cursor_positions;
CREATE POLICY "Users can update own cursor position"
  ON public.cursor_positions FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own cursor position" ON public.cursor_positions;
CREATE POLICY "Users can delete own cursor position"
  ON public.cursor_positions FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_cursor_positions_updated_at ON public.cursor_positions;
CREATE TRIGGER update_cursor_positions_updated_at
  BEFORE UPDATE ON public.cursor_positions
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- =============================================================================
-- 5. Enable Realtime for collaboration tables
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mentions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cursor_positions;


-- ============================================
-- Migration: 014_personal_spaces.sql
-- ============================================
-- Personal Spaces: private items within shared workspaces
-- Run after 013_collaboration.sql

-- =============================================================================
-- 1. Add is_private column to content tables
-- =============================================================================

-- Tables with user_id column
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
ALTER TABLE public.work_entries ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- Tables with created_by column
ALTER TABLE public.pages ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
ALTER TABLE public.mindmaps ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- =============================================================================
-- 2. Add personal_dashboard_config to user_profiles
-- =============================================================================
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS personal_dashboard_config JSONB DEFAULT '{}';

-- =============================================================================
-- 3. Indexes for common queries
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_tasks_private ON public.tasks(workspace_id, is_private, user_id);
CREATE INDEX IF NOT EXISTS idx_work_entries_private ON public.work_entries(workspace_id, is_private, user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_private ON public.reminders(workspace_id, is_private, user_id);
CREATE INDEX IF NOT EXISTS idx_pages_private ON public.pages(workspace_id, is_private, created_by);
CREATE INDEX IF NOT EXISTS idx_boards_private ON public.boards(workspace_id, is_private, created_by);
CREATE INDEX IF NOT EXISTS idx_mindmaps_private ON public.mindmaps(workspace_id, is_private, created_by);
CREATE INDEX IF NOT EXISTS idx_drawings_private ON public.drawings(workspace_id, is_private, created_by);

-- =============================================================================
-- 4. Updated RLS policies — private items only visible to owner
--    Strategy: drop old SELECT policy and recreate with privacy check.
--    When is_private = true, only the owner (user_id / created_by) can see it.
--    When is_private = false (default), normal workspace access applies.
-- =============================================================================

-- ---- tasks (user_id) ----
DROP POLICY IF EXISTS "Workspace viewers can view tasks" ON public.tasks;
CREATE POLICY "Workspace viewers can view tasks"
  ON public.tasks FOR SELECT
  USING (
    public.user_has_workspace_access(workspace_id, 'viewer')
    AND (is_private = false OR user_id = auth.uid())
  );

-- ---- work_entries (user_id) ----
DROP POLICY IF EXISTS "Workspace viewers can view entries" ON public.work_entries;
CREATE POLICY "Workspace viewers can view entries"
  ON public.work_entries FOR SELECT
  USING (
    public.user_has_workspace_access(workspace_id, 'viewer')
    AND (is_private = false OR user_id = auth.uid())
  );

-- ---- reminders (user_id) ----
DROP POLICY IF EXISTS "Workspace viewers can view reminders" ON public.reminders;
CREATE POLICY "Workspace viewers can view reminders"
  ON public.reminders FOR SELECT
  USING (
    public.user_has_workspace_access(workspace_id, 'viewer')
    AND (is_private = false OR user_id = auth.uid())
  );

-- ---- pages (created_by) ----
DROP POLICY IF EXISTS "Workspace viewers can view pages" ON public.pages;
CREATE POLICY "Workspace viewers can view pages"
  ON public.pages FOR SELECT
  USING (
    public.user_has_workspace_access(workspace_id, 'viewer')
    AND (is_private = false OR created_by = auth.uid())
  );

-- ---- boards (created_by) ----
DROP POLICY IF EXISTS "Workspace viewers can view boards" ON public.boards;
CREATE POLICY "Workspace viewers can view boards"
  ON public.boards FOR SELECT
  USING (
    public.user_has_workspace_access(workspace_id, 'viewer')
    AND (is_private = false OR created_by = auth.uid())
  );

-- ---- mindmaps (created_by) ----
DROP POLICY IF EXISTS "Workspace viewers can view mindmaps" ON public.mindmaps;
CREATE POLICY "Workspace viewers can view mindmaps"
  ON public.mindmaps FOR SELECT
  USING (
    public.user_has_workspace_access(workspace_id, 'viewer')
    AND (is_private = false OR created_by = auth.uid())
  );

-- ---- drawings (created_by) ----
DROP POLICY IF EXISTS "Workspace viewers can view drawings" ON public.drawings;
CREATE POLICY "Workspace viewers can view drawings"
  ON public.drawings FOR SELECT
  USING (
    public.user_has_workspace_access(workspace_id, 'viewer')
    AND (is_private = false OR created_by = auth.uid())
  );


-- ============================================
-- Migration: 015_advanced_tasks.sql
-- ============================================
-- 015_advanced_tasks.sql
-- Subtasks (parent_task_id), task dependencies, and task automations

-- ---------------------------------------------------------------------------
-- 1. Subtasks: add parent_task_id to tasks
-- ---------------------------------------------------------------------------

ALTER TABLE tasks
  ADD COLUMN parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;

CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);

-- ---------------------------------------------------------------------------
-- 2. Task dependencies
-- ---------------------------------------------------------------------------

CREATE TABLE task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'blocks', -- 'blocks', 'related'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, depends_on)
);

CREATE INDEX idx_task_dependencies_task_id ON task_dependencies(task_id);
CREATE INDEX idx_task_dependencies_depends_on ON task_dependencies(depends_on);
CREATE INDEX idx_task_dependencies_workspace ON task_dependencies(workspace_id);

-- ---------------------------------------------------------------------------
-- 3. Task automations
-- ---------------------------------------------------------------------------

CREATE TABLE task_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- 'status_change', 'due_date_passed', 'assigned', 'created'
  trigger_config JSONB NOT NULL DEFAULT '{}',
  action_type TEXT NOT NULL, -- 'change_status', 'assign', 'notify', 'move_column'
  action_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_task_automations_workspace ON task_automations(workspace_id);
CREATE INDEX idx_task_automations_active ON task_automations(workspace_id, is_active);

-- ---------------------------------------------------------------------------
-- 4. RLS policies
-- ---------------------------------------------------------------------------

ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_dependencies_select"
  ON task_dependencies FOR SELECT
  USING (user_has_workspace_access(workspace_id, 'viewer'));

CREATE POLICY "task_dependencies_insert"
  ON task_dependencies FOR INSERT
  WITH CHECK (user_has_workspace_access(workspace_id, 'editor'));

CREATE POLICY "task_dependencies_delete"
  ON task_dependencies FOR DELETE
  USING (user_has_workspace_access(workspace_id, 'editor'));

ALTER TABLE task_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_automations_select"
  ON task_automations FOR SELECT
  USING (user_has_workspace_access(workspace_id, 'viewer'));

CREATE POLICY "task_automations_insert"
  ON task_automations FOR INSERT
  WITH CHECK (user_has_workspace_access(workspace_id, 'editor'));

CREATE POLICY "task_automations_update"
  ON task_automations FOR UPDATE
  USING (user_has_workspace_access(workspace_id, 'editor'));

CREATE POLICY "task_automations_delete"
  ON task_automations FOR DELETE
  USING (user_has_workspace_access(workspace_id, 'admin'));


-- ============================================
-- Migration: 016_connectors.sql
-- ============================================
-- Connectors & Integrations
-- Run after 015_advanced_tasks.sql

-- =============================================================================
-- 1. integrations
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'slack', 'google_drive', 'github', 'webhook', 'email'
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrations_workspace ON public.integrations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON public.integrations(workspace_id, type);

-- =============================================================================
-- 2. integration_logs
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'sync', 'webhook_received', 'webhook_sent', 'error'
  payload JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'success', -- 'success', 'error', 'pending'
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_logs_integration ON public.integration_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_workspace ON public.integration_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created ON public.integration_logs(created_at DESC);

-- =============================================================================
-- 3. webhook_endpoints (outgoing)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_workspace ON public.webhook_endpoints(workspace_id);

-- =============================================================================
-- 4. RLS policies for integrations
-- =============================================================================
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace viewers can view integrations" ON public.integrations;
CREATE POLICY "Workspace viewers can view integrations"
  ON public.integrations FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Workspace admins can create integrations" ON public.integrations;
CREATE POLICY "Workspace admins can create integrations"
  ON public.integrations FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'admin'));

DROP POLICY IF EXISTS "Workspace admins can update integrations" ON public.integrations;
CREATE POLICY "Workspace admins can update integrations"
  ON public.integrations FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id, 'admin'));

DROP POLICY IF EXISTS "Workspace admins can delete integrations" ON public.integrations;
CREATE POLICY "Workspace admins can delete integrations"
  ON public.integrations FOR DELETE
  USING (public.user_has_workspace_access(workspace_id, 'admin'));

-- =============================================================================
-- 5. RLS policies for integration_logs
-- =============================================================================
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace viewers can view integration_logs" ON public.integration_logs;
CREATE POLICY "Workspace viewers can view integration_logs"
  ON public.integration_logs FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Workspace admins can create integration_logs" ON public.integration_logs;
CREATE POLICY "Workspace admins can create integration_logs"
  ON public.integration_logs FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'admin'));

DROP POLICY IF EXISTS "Workspace admins can delete integration_logs" ON public.integration_logs;
CREATE POLICY "Workspace admins can delete integration_logs"
  ON public.integration_logs FOR DELETE
  USING (public.user_has_workspace_access(workspace_id, 'admin'));

-- =============================================================================
-- 6. RLS policies for webhook_endpoints
-- =============================================================================
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace viewers can view webhook_endpoints" ON public.webhook_endpoints;
CREATE POLICY "Workspace viewers can view webhook_endpoints"
  ON public.webhook_endpoints FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Workspace admins can create webhook_endpoints" ON public.webhook_endpoints;
CREATE POLICY "Workspace admins can create webhook_endpoints"
  ON public.webhook_endpoints FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'admin'));

DROP POLICY IF EXISTS "Workspace admins can update webhook_endpoints" ON public.webhook_endpoints;
CREATE POLICY "Workspace admins can update webhook_endpoints"
  ON public.webhook_endpoints FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id, 'admin'));

DROP POLICY IF EXISTS "Workspace admins can delete webhook_endpoints" ON public.webhook_endpoints;
CREATE POLICY "Workspace admins can delete webhook_endpoints"
  ON public.webhook_endpoints FOR DELETE
  USING (public.user_has_workspace_access(workspace_id, 'admin'));

-- =============================================================================
-- 7. updated_at trigger for integrations
-- =============================================================================
DROP TRIGGER IF EXISTS update_integrations_updated_at ON public.integrations;
CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();


-- Whitelist requests (public form for people to request access)
CREATE TABLE IF NOT EXISTS public.whitelist_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whitelist_requests_status
  ON public.whitelist_requests(status);

-- Allow anonymous inserts (public form) but only admin reads
ALTER TABLE public.whitelist_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a request (no auth needed)
DROP POLICY IF EXISTS "Anyone can submit whitelist request" ON public.whitelist_requests;
CREATE POLICY "Anyone can submit whitelist request"
  ON public.whitelist_requests FOR INSERT
  WITH CHECK (true);

-- Only service_role can read (admin API uses service role)
-- No SELECT policy for anon/authenticated = only admin client can read

-- Feedback from users
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  email TEXT,
  name TEXT,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('bug', 'feature', 'general', 'complaint')),
  message TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_status
  ON public.user_feedback(status);

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Authenticated users can submit feedback
DROP POLICY IF EXISTS "Users can submit feedback" ON public.user_feedback;
CREATE POLICY "Users can submit feedback"
  ON public.user_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
DROP POLICY IF EXISTS "Users can view own feedback" ON public.user_feedback;
CREATE POLICY "Users can view own feedback"
  ON public.user_feedback FOR SELECT
  USING (auth.uid() = user_id);
