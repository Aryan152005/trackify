-- 21-day (and N-day) challenges — supports 3 modes via a unified JSONB `days` array:
--   habit    : track completion per day (boolean) + optional note
--   kanban   : each day holds a small task list [{id,title,done}]
--   roadmap  : each day has planned goals [string] + completion flag

CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('habit', 'kanban', 'roadmap')),
  title TEXT NOT NULL,
  description TEXT,
  started_at DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_days INTEGER NOT NULL DEFAULT 21 CHECK (duration_days > 0 AND duration_days <= 365),
  days JSONB NOT NULL DEFAULT '[]',
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenges_user ON public.challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_challenges_workspace ON public.challenges(workspace_id);
CREATE INDEX IF NOT EXISTS idx_challenges_active ON public.challenges(user_id, is_archived) WHERE is_archived = false;

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

-- User can see and manage their own challenges (personal); workspace members see shared ones
DROP POLICY IF EXISTS "Users see own challenges" ON public.challenges;
CREATE POLICY "Users see own challenges"
  ON public.challenges FOR SELECT
  USING (
    user_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.user_has_workspace_access(workspace_id, 'viewer'))
  );

DROP POLICY IF EXISTS "Users create own challenges" ON public.challenges;
CREATE POLICY "Users create own challenges"
  ON public.challenges FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own challenges" ON public.challenges;
CREATE POLICY "Users update own challenges"
  ON public.challenges FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own challenges" ON public.challenges;
CREATE POLICY "Users delete own challenges"
  ON public.challenges FOR DELETE
  USING (user_id = auth.uid());
