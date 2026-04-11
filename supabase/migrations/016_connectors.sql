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
