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
