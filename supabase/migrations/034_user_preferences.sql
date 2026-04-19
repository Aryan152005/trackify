-- Per-user UI/UX preferences blob.
--
-- Kept as a single JSONB column rather than one column per preference so
-- new prefs ship without schema churn. RLS: the user reads/writes only
-- their own row (the existing user_profiles policies already cover this
-- — the profile row's user_id is auth.uid()).
--
-- Default shape (kept in sync with src/lib/preferences/types.ts):
--   {
--     "landingPage":   "dashboard" | "today" | "tasks" | "notes",
--     "listDensity":   "compact"  | "comfortable",
--     "accentColor":   "indigo"   | "blue" | "emerald" | "amber" | "rose" | "purple",
--     "fabVisible":    true | false,
--     "defaultTaskView":     "list" | "board",
--     "defaultCalendarView": "month" | "week"
--   }
-- Missing keys fall back to defaults in code, so adding a new pref later
-- doesn't break old rows.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}';

-- No index — it's only ever read by primary key (user_id).
