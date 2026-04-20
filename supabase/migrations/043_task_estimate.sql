-- Add an optional time-estimate to tasks. Minutes; nullable so existing
-- rows stay untouched. When set, the task detail page offers a
-- "Schedule it on calendar" action that creates a calendar_event with
-- end_time = start_time + estimate_minutes (Motion-inspired, but
-- user-consented — no auto-scheduling).

BEGIN;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS estimate_minutes INTEGER
  CHECK (estimate_minutes IS NULL OR estimate_minutes > 0);

COMMIT;
