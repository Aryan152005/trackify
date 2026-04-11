-- Optional: seed a few tags so "Add entry" form has tags to select.
-- Run in Supabase SQL Editor after 001_initial_schema.sql.

INSERT INTO public.tags (name, color) VALUES
  ('Frontend', '#3b82f6'),
  ('Backend', '#22c55e'),
  ('Learning', '#eab308'),
  ('Meeting', '#a855f7'),
  ('Documentation', '#f97316')
ON CONFLICT (name) DO NOTHING;
