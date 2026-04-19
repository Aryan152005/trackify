-- User activity heartbeat — `auth.users.last_sign_in_at` only updates on login,
-- which gives a false "inactive" signal for users who stay logged in for weeks.
-- Track a separate `last_activity_at` that the client pings periodically.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS user_profiles_last_activity_idx
  ON public.user_profiles (last_activity_at DESC NULLS LAST);

-- RPC: bump the caller's own last_activity_at. SECURITY DEFINER so users can
-- update their own row without needing a blanket UPDATE RLS policy.
CREATE OR REPLACE FUNCTION public.touch_user_activity()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.user_profiles
     SET last_activity_at = NOW()
   WHERE user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.touch_user_activity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_user_activity() TO authenticated;

-- Backfill: seed last_activity_at from updated_at so the admin dashboard has
-- a reasonable value for existing users on first deploy.
UPDATE public.user_profiles
   SET last_activity_at = updated_at
 WHERE last_activity_at IS NULL;
