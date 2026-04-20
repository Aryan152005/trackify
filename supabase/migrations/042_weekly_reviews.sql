-- Weekly review — one row per user per ISO week (Mon-Sun in IST).
--
-- The Friday-5pm-IST modal asks the user: what shipped, what slipped,
-- one line of reflection. The auto-filled "shipped" + "slipped" bits
-- are computed from tasks + reminders on render and not stored (data
-- would rot). Only the user's free-text reflection is persisted.
--
-- Reviews are STRICTLY per-user, like daily_plans — they describe a
-- person's working week, never a workspace's. If a user belongs to
-- multiple workspaces the review spans all of them.

BEGIN;

CREATE TABLE IF NOT EXISTS public.weekly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The Monday (IST) of the ISO week this review covers. One review per
  -- week per user.
  week_start DATE NOT NULL,
  reflection TEXT NOT NULL CHECK (char_length(reflection) BETWEEN 1 AND 2000),
  -- Optional "one thing to change next week" — separate field because
  -- in practice users write EITHER looking-back OR looking-forward
  -- and we want to let both coexist without a forced structure.
  next_week_intent TEXT CHECK (char_length(next_week_intent) <= 500),
  -- Cached at time of save so the admin analytics surface can show
  -- "average shipped per week" without re-computing.
  shipped_count INT NOT NULL DEFAULT 0,
  slipped_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_reviews_user_week
  ON public.weekly_reviews(user_id, week_start DESC);

ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own reviews" ON public.weekly_reviews;
CREATE POLICY "Users manage own reviews"
  ON public.weekly_reviews FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;
