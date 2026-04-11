-- Optional: seed email whitelist. Use LOWERCASE emails only (login normalizes to lowercase).
-- Run in Supabase SQL Editor after 001_initial_schema.sql.

INSERT INTO public.email_whitelist (email) VALUES
  ('paratakkearyan@gmail.com'),
  ('admin@example.com'),
  ('user@example.com')
ON CONFLICT (email) DO NOTHING;

-- To add more emails later (always use lowercase):
-- INSERT INTO public.email_whitelist (email) VALUES ('yourname@example.com') ON CONFLICT (email) DO NOTHING;
