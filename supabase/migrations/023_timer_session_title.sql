-- Optional label for a focus session (e.g. "Writing proposal", "Studying SQL")
ALTER TABLE public.timer_sessions
  ADD COLUMN IF NOT EXISTS title TEXT;
