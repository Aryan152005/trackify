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
