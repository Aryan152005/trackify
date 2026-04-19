-- Admin broadcasts — a push blast is now a first-class entity.
--
-- Previously a broadcast was fire-and-forget: admin types a message,
-- web-push delivers to N subscriptions, only evidence is one system_logs
-- row. Users had no way to react/comment and admin had no way to see
-- what landed. This migration changes that.
--
-- Three new tables:
--   1. admin_broadcasts — one row per send, used for history + threading
--   2. admin_broadcast_reactions — emoji reactions per user
--   3. admin_broadcast_comments — text replies per user
--
-- Also relaxes notifications.workspace_id to NULL so an admin broadcast
-- can create an in-app notification per user without an arbitrary
-- workspace pick. The existing SELECT/UPDATE/DELETE RLS is user-scoped
-- (user_id = auth.uid()) so a NULL workspace_id doesn't widen visibility.
-- The INSERT policy gated "workspace editor" is left alone — admin
-- broadcasts insert via the service-role client, which bypasses RLS.

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 0. notifications.workspace_id → nullable
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.notifications
  ALTER COLUMN workspace_id DROP NOT NULL;

-- The existing INSERT policy references workspace_id. If workspace_id is
-- NULL, user_has_workspace_access() would return false — which would
-- block users from ever creating NULL-workspace notifications. But user
-- code doesn't do that; admin service-role does. Keep the policy as-is.

-- ─────────────────────────────────────────────────────────────
-- 1. admin_broadcasts
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who sent it. Snapshotted email so we can show "sent by {email}"
  -- even if the admin account is later deleted.
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_email TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  target TEXT NOT NULL CHECK (target IN ('all', 'selected', 'inactive_24h')),
  -- Cached counts at time of send (for the history list without fanning
  -- out joins). reaction_count / comment_count are maintained live via
  -- triggers below, for cheap display on the admin list view.
  targeted_count INT NOT NULL DEFAULT 0,
  delivered_count INT NOT NULL DEFAULT 0,
  reaction_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_broadcasts_created
  ON public.admin_broadcasts(created_at DESC);

ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;

-- SELECT — any authenticated user (so a recipient can render the
-- broadcast body when they open their notification panel).
DROP POLICY IF EXISTS "Authenticated users can read broadcasts" ON public.admin_broadcasts;
CREATE POLICY "Authenticated users can read broadcasts"
  ON public.admin_broadcasts FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT/UPDATE/DELETE — not exposed to end users. Admin goes through
-- the service-role client which bypasses RLS. No policies are defined,
-- so non-service clients get DENY by default.

-- ─────────────────────────────────────────────────────────────
-- 2. admin_broadcast_reactions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_broadcast_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID NOT NULL REFERENCES public.admin_broadcasts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One user, one emoji, one time — re-tapping the same emoji toggles
  -- the row off (via DELETE).
  UNIQUE (broadcast_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_broadcast_reactions_broadcast
  ON public.admin_broadcast_reactions(broadcast_id);

ALTER TABLE public.admin_broadcast_reactions ENABLE ROW LEVEL SECURITY;

-- SELECT — any authenticated user (admin sees who reacted; each user
-- sees their own reactions + peers' for a "N people liked this" count).
DROP POLICY IF EXISTS "Auth users read reactions" ON public.admin_broadcast_reactions;
CREATE POLICY "Auth users read reactions"
  ON public.admin_broadcast_reactions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT — only as self.
DROP POLICY IF EXISTS "Users create own reactions" ON public.admin_broadcast_reactions;
CREATE POLICY "Users create own reactions"
  ON public.admin_broadcast_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- DELETE — only own reaction.
DROP POLICY IF EXISTS "Users delete own reactions" ON public.admin_broadcast_reactions;
CREATE POLICY "Users delete own reactions"
  ON public.admin_broadcast_reactions FOR DELETE
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 3. admin_broadcast_comments
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_broadcast_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID NOT NULL REFERENCES public.admin_broadcasts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_comments_broadcast
  ON public.admin_broadcast_comments(broadcast_id, created_at DESC);

ALTER TABLE public.admin_broadcast_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users read comments" ON public.admin_broadcast_comments;
CREATE POLICY "Auth users read comments"
  ON public.admin_broadcast_comments FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users create own comments" ON public.admin_broadcast_comments;
CREATE POLICY "Users create own comments"
  ON public.admin_broadcast_comments FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own comments" ON public.admin_broadcast_comments;
CREATE POLICY "Users delete own comments"
  ON public.admin_broadcast_comments FOR DELETE
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 4. Triggers — keep cached counts on admin_broadcasts in sync
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.bump_broadcast_reaction_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.admin_broadcasts
      SET reaction_count = reaction_count + 1
      WHERE id = NEW.broadcast_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.admin_broadcasts
      SET reaction_count = GREATEST(0, reaction_count - 1)
      WHERE id = OLD.broadcast_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_broadcast_reaction_count
  ON public.admin_broadcast_reactions;
CREATE TRIGGER trg_broadcast_reaction_count
  AFTER INSERT OR DELETE ON public.admin_broadcast_reactions
  FOR EACH ROW EXECUTE FUNCTION public.bump_broadcast_reaction_count();

CREATE OR REPLACE FUNCTION public.bump_broadcast_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.admin_broadcasts
      SET comment_count = comment_count + 1
      WHERE id = NEW.broadcast_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.admin_broadcasts
      SET comment_count = GREATEST(0, comment_count - 1)
      WHERE id = OLD.broadcast_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_broadcast_comment_count
  ON public.admin_broadcast_comments;
CREATE TRIGGER trg_broadcast_comment_count
  AFTER INSERT OR DELETE ON public.admin_broadcast_comments
  FOR EACH ROW EXECUTE FUNCTION public.bump_broadcast_comment_count();

COMMIT;
