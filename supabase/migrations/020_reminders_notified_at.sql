-- Track when a push notification was sent for a reminder so we don't spam users
-- when the cron runs every few minutes.

ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

-- Only index unsent upcoming reminders — keeps the index small and fast.
CREATE INDEX IF NOT EXISTS idx_reminders_due_unnotified
  ON public.reminders(reminder_time)
  WHERE notified_at IS NULL AND is_completed = false;
