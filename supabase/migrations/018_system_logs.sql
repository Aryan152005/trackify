-- System-wide logs for admin observability.
-- Captures events from server actions, auth flows, admin ops, background jobs, etc.
-- Distinct from activity_log (user-facing entity actions) and integration_logs (integration-specific).

CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,                         -- e.g. 'email', 'auth', 'admin', 'cron', 'api'
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  tag TEXT,                                       -- short machine-readable category, e.g. 'whitelist.add'
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes tuned for the admin logs viewer filters
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_service_created ON public.system_logs(service, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level_created ON public.system_logs(level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_tag ON public.system_logs(tag) WHERE tag IS NOT NULL;

-- Service role only — admin UI uses service role to query
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
