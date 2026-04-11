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
