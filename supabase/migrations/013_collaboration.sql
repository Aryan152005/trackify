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
