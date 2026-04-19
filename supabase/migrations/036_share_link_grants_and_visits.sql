-- Share-link grants + visit audit log.
--
-- Builds two capabilities on top of migration 013's `shared_links`:
--
-- 1. Per-email grants. A link creator (or workspace admin, or an existing
--    editor-grant holder) can name specific emails and pick their access
--    level (view / editor). An `editor` grant auto-promotes the grantee
--    to a workspace editor on their first visit — that's what makes the
--    permission field actually do something for people outside the
--    workspace.
--
-- 2. Visit audit. Every hit to /shared/{token} (via the public API route)
--    lands a row in `shared_link_visits` with the outcome. Gives link
--    creators + admins a forensic trail: who opened it, when, and whether
--    it auto-joined or was denied.

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. shared_link_grants
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shared_link_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_link_id UUID NOT NULL REFERENCES public.shared_links(id) ON DELETE CASCADE,
  -- Denormalise workspace_id so RLS policies on THIS table don't have to
  -- join shared_links every time. Kept in sync by the app-level insert.
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  -- Email is the addressing key. Stored lowercased so lookups match.
  email TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'editor')),
  granted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  -- Filled once a signed-in user whose auth email matches `email` opens
  -- the link. Useful for "has Alice actually used the grant I sent her?".
  consumed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_used_at TIMESTAMPTZ,
  UNIQUE (shared_link_id, email)
);

CREATE INDEX IF NOT EXISTS idx_share_grants_link
  ON public.shared_link_grants(shared_link_id);
CREATE INDEX IF NOT EXISTS idx_share_grants_email
  ON public.shared_link_grants(email);
CREATE INDEX IF NOT EXISTS idx_share_grants_workspace
  ON public.shared_link_grants(workspace_id);

ALTER TABLE public.shared_link_grants ENABLE ROW LEVEL SECURITY;

-- Who can SEE a grant:
--   - the link creator (shared_links.created_by = auth.uid())
--   - any workspace admin
--   - the grantee themselves (email matches their JWT email)
DROP POLICY IF EXISTS "View own or creator or admin grants" ON public.shared_link_grants;
CREATE POLICY "View own or creator or admin grants"
  ON public.shared_link_grants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_links sl
      WHERE sl.id = shared_link_id
        AND sl.created_by = auth.uid()
    )
    OR public.user_has_workspace_access(workspace_id, 'admin')
    OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );

-- Who can CREATE a grant: link creator OR workspace admin.
-- (Delegation — existing editor grantees adding lower-tier grants — is
-- handled in the server action, not RLS, because it needs to check the
-- caller's own grant row which would require a self-join.)
DROP POLICY IF EXISTS "Creator or admin can grant" ON public.shared_link_grants;
CREATE POLICY "Creator or admin can grant"
  ON public.shared_link_grants FOR INSERT
  WITH CHECK (
    granted_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.shared_links sl
        WHERE sl.id = shared_link_id
          AND sl.created_by = auth.uid()
      )
      OR public.user_has_workspace_access(workspace_id, 'admin')
    )
  );

-- Who can REVOKE (update revoked_at): link creator or workspace admin.
DROP POLICY IF EXISTS "Creator or admin can revoke" ON public.shared_link_grants;
CREATE POLICY "Creator or admin can revoke"
  ON public.shared_link_grants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_links sl
      WHERE sl.id = shared_link_id
        AND sl.created_by = auth.uid()
    )
    OR public.user_has_workspace_access(workspace_id, 'admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shared_links sl
      WHERE sl.id = shared_link_id
        AND sl.created_by = auth.uid()
    )
    OR public.user_has_workspace_access(workspace_id, 'admin')
  );

-- Physical delete: same gates as revoke.
DROP POLICY IF EXISTS "Creator or admin can delete grant" ON public.shared_link_grants;
CREATE POLICY "Creator or admin can delete grant"
  ON public.shared_link_grants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_links sl
      WHERE sl.id = shared_link_id
        AND sl.created_by = auth.uid()
    )
    OR public.user_has_workspace_access(workspace_id, 'admin')
  );

-- ─────────────────────────────────────────────────────────────
-- 2. shared_link_visits
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shared_link_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_link_id UUID NOT NULL REFERENCES public.shared_links(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  visitor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  visitor_email TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN (
    'view',
    'auto-joined-workspace',
    'denied-private',
    'denied-expired',
    'denied-revoked',
    'denied-not-found'
  )),
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_share_visits_link
  ON public.shared_link_visits(shared_link_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_visits_workspace
  ON public.shared_link_visits(workspace_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_visits_visitor
  ON public.shared_link_visits(visitor_user_id, accessed_at DESC)
  WHERE visitor_user_id IS NOT NULL;

ALTER TABLE public.shared_link_visits ENABLE ROW LEVEL SECURITY;

-- Visits are SELECTed by the link creator or workspace admin only.
-- Inserts happen from the service-role client (the share API route), so
-- no INSERT policy is needed — RLS is bypassed there.
DROP POLICY IF EXISTS "Creator or admin can see visits" ON public.shared_link_visits;
CREATE POLICY "Creator or admin can see visits"
  ON public.shared_link_visits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_links sl
      WHERE sl.id = shared_link_id
        AND sl.created_by = auth.uid()
    )
    OR public.user_has_workspace_access(workspace_id, 'admin')
  );

COMMIT;
