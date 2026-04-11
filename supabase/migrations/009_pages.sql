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
