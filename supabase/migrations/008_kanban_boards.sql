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
