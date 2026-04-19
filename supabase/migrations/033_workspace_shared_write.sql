-- Workspace-shared writes, private-lane preserved.
--
-- The SELECT policies from migration 014 already let workspace members see
-- each other's non-private items. This migration does two things:
--
--   1. Extends the UPDATE/DELETE policies to honour `is_private` — a workspace
--      editor can now update/delete any NON-private task / entry / board /
--      page / mindmap / drawing owned by any member, but cannot touch a
--      private one unless they are the owner.
--
--   2. Relaxes DELETE from admin-only to editor+ for the content tables, so
--      a team member can both create AND delete shared items as the user
--      requested. Owner/admin-only operations (workspace delete, role change)
--      are unaffected.
--
-- Reminders are intentionally NOT broadened — reminders are per-user
-- notifications. The existing "editor can update/delete reminders in this
-- workspace" policy stays, but the UI + cron filter by user_id so only the
-- creator ever sees or fires a push for a reminder they created.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- tasks (owner column: user_id)
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Workspace editors can update tasks" ON public.tasks;
CREATE POLICY "Workspace editors can update tasks"
  ON public.tasks FOR UPDATE
  USING (
    public.user_has_workspace_access(workspace_id, 'editor')
    AND (is_private = false OR user_id = auth.uid())
  )
  WITH CHECK (
    public.user_has_workspace_access(workspace_id, 'editor')
    AND (is_private = false OR user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Workspace admins can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Workspace editors can delete tasks" ON public.tasks;
CREATE POLICY "Workspace editors can delete tasks"
  ON public.tasks FOR DELETE
  USING (
    public.user_has_workspace_access(workspace_id, 'editor')
    AND (is_private = false OR user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- work_entries (owner column: user_id)
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Workspace editors can update work_entries" ON public.work_entries;
CREATE POLICY "Workspace editors can update work_entries"
  ON public.work_entries FOR UPDATE
  USING (
    public.user_has_workspace_access(workspace_id, 'editor')
    AND (is_private = false OR user_id = auth.uid())
  )
  WITH CHECK (
    public.user_has_workspace_access(workspace_id, 'editor')
    AND (is_private = false OR user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Workspace admins can delete work_entries" ON public.work_entries;
DROP POLICY IF EXISTS "Workspace editors can delete work_entries" ON public.work_entries;
CREATE POLICY "Workspace editors can delete work_entries"
  ON public.work_entries FOR DELETE
  USING (
    public.user_has_workspace_access(workspace_id, 'editor')
    AND (is_private = false OR user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- boards (owner column: created_by)
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Workspace editors can update boards" ON public.boards;
CREATE POLICY "Workspace editors can update boards"
  ON public.boards FOR UPDATE
  USING (
    public.user_has_workspace_access(workspace_id, 'editor')
    AND (is_private = false OR created_by = auth.uid())
  )
  WITH CHECK (
    public.user_has_workspace_access(workspace_id, 'editor')
    AND (is_private = false OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Workspace admins can delete boards" ON public.boards;
DROP POLICY IF EXISTS "Workspace editors can delete boards" ON public.boards;
CREATE POLICY "Workspace editors can delete boards"
  ON public.boards FOR DELETE
  USING (
    public.user_has_workspace_access(workspace_id, 'editor')
    AND (is_private = false OR created_by = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- pages (owner column: created_by)
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Workspace editors can update pages" ON public.pages;
CREATE POLICY "Workspace editors can update pages"
  ON public.pages FOR UPDATE
  USING (
    public.user_has_workspace_access(workspace_id, 'editor')
    AND (is_private = false OR created_by = auth.uid())
  )
  WITH CHECK (
    public.user_has_workspace_access(workspace_id, 'editor')
    AND (is_private = false OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Workspace admins can delete pages" ON public.pages;
DROP POLICY IF EXISTS "Workspace editors can delete pages" ON public.pages;
CREATE POLICY "Workspace editors can delete pages"
  ON public.pages FOR DELETE
  USING (
    public.user_has_workspace_access(workspace_id, 'editor')
    AND (is_private = false OR created_by = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- mindmaps (owner column: created_by)
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Workspace editors can update mindmaps" ON public.mindmaps;
CREATE POLICY "Workspace editors can update mindmaps"
  ON public.mindmaps FOR UPDATE
  USING (
    public.user_has_workspace_access(workspace_id, 'editor')
    AND (is_private = false OR created_by = auth.uid())
  )
  WITH CHECK (
    public.user_has_workspace_access(workspace_id, 'editor')
    AND (is_private = false OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Workspace admins can delete mindmaps" ON public.mindmaps;
DROP POLICY IF EXISTS "Workspace editors can delete mindmaps" ON public.mindmaps;
CREATE POLICY "Workspace editors can delete mindmaps"
  ON public.mindmaps FOR DELETE
  USING (
    public.user_has_workspace_access(workspace_id, 'editor')
    AND (is_private = false OR created_by = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- drawings (owner column: created_by)
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Workspace editors can update drawings" ON public.drawings;
CREATE POLICY "Workspace editors can update drawings"
  ON public.drawings FOR UPDATE
  USING (
    public.user_has_workspace_access(workspace_id, 'editor')
    AND (is_private = false OR created_by = auth.uid())
  )
  WITH CHECK (
    public.user_has_workspace_access(workspace_id, 'editor')
    AND (is_private = false OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Workspace admins can delete drawings" ON public.drawings;
DROP POLICY IF EXISTS "Workspace editors can delete drawings" ON public.drawings;
CREATE POLICY "Workspace editors can delete drawings"
  ON public.drawings FOR DELETE
  USING (
    public.user_has_workspace_access(workspace_id, 'editor')
    AND (is_private = false OR created_by = auth.uid())
  );

COMMIT;
