-- Extend RLS on shared_link_grants so that a grantee (non-workspace member)
-- can delegate their access onwards.
--
-- The original migration 036 only let the link creator / workspace admins
-- issue or revoke grants. That closes the loop the product needs: a
-- view-grantee receives a link, and we want them to be able to forward it
-- to someone else (and later revoke that access). The server action
-- (addLinkGrant) still enforces the "never escalate above your own level"
-- cap; this migration only opens the RLS channels the action relies on.
--
-- Concretely, for any row referencing a shared_link where the caller holds
-- an active grant:
--   - SELECT: they may see all grants on that same link (so the UI can
--     list "people you've invited" and show whether they've consumed it).
--   - INSERT: they may create new grants on that same link. The server
--     action caps permission at the caller's own level and refuses
--     escalation; this policy just says "yes, the row may exist".
--   - UPDATE (revoke): they may revoke grants they themselves issued
--     (granted_by = auth.uid()) — so a delegator can take back access.
--
-- Workspace admins and link creators keep all of their existing powers
-- via the 036 policies; these new policies are additive.

BEGIN;

-- SELECT — grantee can see all active grants on links where they hold one.
DROP POLICY IF EXISTS "Grantees see co-grants on same link" ON public.shared_link_grants;
CREATE POLICY "Grantees see co-grants on same link"
  ON public.shared_link_grants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_link_grants peer
      WHERE peer.shared_link_id = shared_link_grants.shared_link_id
        AND peer.revoked_at IS NULL
        AND lower(peer.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    )
  );

-- INSERT — grantee can create grants on links where they hold one.
-- Server action caps the permission at the caller's tier.
DROP POLICY IF EXISTS "Grantees can delegate on same link" ON public.shared_link_grants;
CREATE POLICY "Grantees can delegate on same link"
  ON public.shared_link_grants FOR INSERT
  WITH CHECK (
    granted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.shared_link_grants peer
      WHERE peer.shared_link_id = shared_link_grants.shared_link_id
        AND peer.revoked_at IS NULL
        AND lower(peer.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    )
  );

-- UPDATE — grantee can revoke (or re-grant via upsert) grants they issued.
DROP POLICY IF EXISTS "Grantees can revoke grants they issued" ON public.shared_link_grants;
CREATE POLICY "Grantees can revoke grants they issued"
  ON public.shared_link_grants FOR UPDATE
  USING (granted_by = auth.uid())
  WITH CHECK (granted_by = auth.uid());

COMMIT;
