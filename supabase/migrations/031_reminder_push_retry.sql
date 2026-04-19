-- Track push delivery attempts per reminder so transient failures (network
-- blips, GCM 5xx) can be retried by the next cron tick instead of being
-- silently dropped when `notified_at` was set after a single failed try.
--
-- Rule (enforced in the cron route):
--   - Successful delivery (at least 1 push sent) → set notified_at, done.
--   - User has zero subscriptions               → set notified_at, done
--                                                  (nothing will ever deliver).
--   - All attempts failed                       → increment push_attempts.
--     After MAX_PUSH_ATTEMPTS (3) hit, give up and set notified_at so the
--     cron stops re-selecting this reminder.
--
-- The existing partial index `idx_reminders_due_unnotified` already filters
-- on notified_at IS NULL, so retry selection is still fast.

ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS push_attempts INT NOT NULL DEFAULT 0;

-- Optional: include push_attempts in the index so the cron query can bail
-- early on reminders that have hit the retry ceiling.
-- (Kept simple — the WHERE-partial index still prunes enough.)
