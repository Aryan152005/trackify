-- Enable Supabase Realtime for the main entity tables so detail pages can
-- reflect live updates from peers (title/icon/archive/drag-drop etc.) without
-- requiring a manual refresh.

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['pages', 'tasks', 'boards', 'board_columns', 'mindmaps', 'drawings', 'challenges']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
