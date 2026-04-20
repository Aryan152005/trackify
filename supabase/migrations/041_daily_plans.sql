-- Daily plans — one "what I'm actually doing today" list per user per IST day.
--
-- /today already shows everything due today, which creates ambient noise
-- (tasks the user doesn't actually plan to touch show up anyway). This
-- table stores the user's EXPLICIT pick of 3-5 items per day. Inspired
-- by Things 3's discipline: the Today list is what you've decided to do,
-- not what the system thinks might matter.
--
-- Schema:
--   (user_id, plan_date) is the natural key — one plan per user per day.
--   task_ids is a UUID[] rather than a join table because:
--     (a) a plan is always read/written as a whole, never row-wise
--     (b) ordering matters (the user drags items into priority)
--     (c) reads are cheap — a Postgres UUID[] with 3-5 entries is trivial
--   We store task_ids and hydrate task details at render time via a
--   separate tasks SELECT. That lets the plan survive even if a task
--   is renamed, deleted, or moved between workspaces.

BEGIN;

CREATE TABLE IF NOT EXISTS public.daily_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  task_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  -- Free-form note the user can add when planning — "focus: ship the
  -- onboarding email" or "today is a low-energy day". Optional.
  intention TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_plans_user_date
  ON public.daily_plans(user_id, plan_date DESC);

ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;

-- SELECT / INSERT / UPDATE / DELETE — strictly per-user. Plans are
-- never shared, even inside a workspace.
DROP POLICY IF EXISTS "Users manage own daily plans" ON public.daily_plans;
CREATE POLICY "Users manage own daily plans"
  ON public.daily_plans FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-bump updated_at on every update. Handy for the "you planned
-- today X minutes ago" affordance in the UI.
CREATE OR REPLACE FUNCTION public.touch_daily_plan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_daily_plan_updated_at ON public.daily_plans;
CREATE TRIGGER trg_daily_plan_updated_at
  BEFORE UPDATE ON public.daily_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_daily_plan_updated_at();

COMMIT;
