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
