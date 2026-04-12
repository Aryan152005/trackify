-- Tighten RLS on workspace_invitations:
--   - Workspace admins can read invitations for their workspace (to list pending ones)
--   - The invited recipient can read the specific invitation addressed to their email
--   - Remove the blanket "any authenticated user can read all invitations" policy
-- Token-based reads (for the accept API) still work via the admin client
-- (createAdminClient bypasses RLS).

DROP POLICY IF EXISTS "Anyone can read invitations by token" ON public.workspace_invitations;

DROP POLICY IF EXISTS "Invitee can read own invitation" ON public.workspace_invitations;
CREATE POLICY "Invitee can read own invitation"
  ON public.workspace_invitations FOR SELECT
  TO authenticated
  USING (lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())));

-- The existing "Admins can manage invitations" policy (FOR ALL) already covers
-- admin reads of workspace invitations, so no new admin-specific SELECT needed.
