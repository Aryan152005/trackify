-- Enable Supabase Realtime for workspace membership tables so the members page
-- can refresh live when someone is added/removed or an invitation is accepted.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'workspace_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_members;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'workspace_invitations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_invitations;
  END IF;
END $$;
