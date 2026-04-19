-- Backfill: shift wrongly-stored reminder times into true IST.
--
-- Prior to the IST datetime helper (see lib/utils/datetime), reminders created
-- via `createTask()` used `new Date("YYYY-MM-DDTHH:MM:SS").toISOString()` on
-- the SERVER. On Vercel (UTC) that stored 09:00Z instead of the IST-intended
-- 09:00 (= 03:30Z), making reminders fire 5h30m late (14:30 IST).
--
-- Scope:
--   - Task-linked reminders (title LIKE 'Task due:%') — these were definitely
--     server-side bugged, regardless of browser timezone.
--   - Only future-or-unfired ones (is_completed=false AND notified_at IS NULL).
--     Past-and-already-fired reminders are history — don't rewrite them.
--   - Only those created before this migration applied (created_at cutoff).
--
-- This is NOT applied to user-created reminders from /reminders/new — those
-- were parsed in the browser, so for IST users they were correct. Shifting
-- them would break correct data. If you find wrong user-created ones, fix
-- each in the UI (edit is now supported).

BEGIN;

-- Snapshot what we're about to change into system_logs for audit
INSERT INTO public.system_logs (service, level, tag, message, metadata, created_at)
SELECT
  'cron'                                     AS service,
  'info'                                     AS level,
  'remindersBackfill.pre'                    AS tag,
  format(
    'Shifting reminder %s (title=%s) from %s to %s',
    id::text, title, reminder_time::text, (reminder_time - INTERVAL '5 hours 30 minutes')::text
  )                                          AS message,
  jsonb_build_object(
    'reminder_id', id,
    'user_id',     user_id,
    'was',         reminder_time,
    'now',         reminder_time - INTERVAL '5 hours 30 minutes'
  )                                          AS metadata,
  NOW()                                      AS created_at
FROM public.reminders
WHERE title LIKE 'Task due:%'
  AND is_completed = false
  AND notified_at IS NULL
  AND created_at < NOW();  -- snapshot before the UPDATE below lands

UPDATE public.reminders
   SET reminder_time = reminder_time - INTERVAL '5 hours 30 minutes'
 WHERE title LIKE 'Task due:%'
   AND is_completed = false
   AND notified_at IS NULL
   AND created_at < NOW();

COMMIT;
