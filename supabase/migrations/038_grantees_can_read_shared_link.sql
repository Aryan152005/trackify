-- Extend shared_links SELECT visibility to grantees.
--
-- Migration 013 scoped `shared_links` SELECT to workspace viewers+. That
-- was fine when the only reader was the workspace-side audit UI; but now
-- (migrations 036 + 037) a non-member grantee can open /shared/[token],
-- hold a grant row, and delegate access onwards via `addLinkGrant`. That
-- server action loads the shared_links row via the user-scoped client
-- before issuing the grant — and without this policy, the load silently
-- returns no rows, so the action throws "Share link not found or you
-- don't have access".
--
-- This policy is additive (Postgres OR's multiple permissive SELECT
-- policies together) and piggybacks on the existing shared_link_grants
-- row the caller already holds. No change to INSERT / UPDATE / DELETE on
-- shared_links — a grantee still can't create or revoke shared_links
-- themselves.

BEGIN;

DROP POLICY IF EXISTS "Grantees can view shared link they hold grant for" ON public.shared_links;
CREATE POLICY "Grantees can view shared link they hold grant for"
  ON public.shared_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_link_grants g
      WHERE g.shared_link_id = shared_links.id
        AND g.revoked_at IS NULL
        AND lower(g.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    )
  );

COMMIT;
