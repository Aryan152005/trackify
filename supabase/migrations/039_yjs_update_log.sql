-- Append-only update log for Yjs collab docs.
--
-- Before this migration, live collab on drawings / mindmaps / pages relied
-- on a 3-second debounced write of the FULL Yjs state into the entity's
-- `yjs_state BYTEA` column. That has two failure modes users hit often:
--
--   1. Tab-close race: draw → close tab within 3s → the debounce never
--      fires, the bytes stay in memory, and the next reload shows stale
--      state. "It didn't save."
--   2. No incremental persistence: Supabase broadcast is a pub/sub firehose
--      with zero history. If two peers were synchronised in-memory and one
--      closed, the other's next reload restored from the on-disk snapshot
--      — which may pre-date the last minutes of collaboration.
--
-- This migration adds an append-only log. Every local Yjs update is
-- inserted as one row the moment it happens (batched 300 ms client-side).
-- On initial load the provider fetches `yjs_state` + every log row for
-- the entity, then applies them in order — CRDT merge handles concurrent
-- edits correctly. A periodic / on-destroy compaction step rewrites the
-- snapshot and deletes merged log rows to keep the table bounded.
--
-- RLS gate: we do NOT denormalise workspace_id; instead each policy
-- `EXISTS`-joins into the target entity table, so access inherits the
-- entity's own RLS (workspace membership + is_private).

BEGIN;

CREATE TABLE IF NOT EXISTS public.yjs_updates (
  id BIGSERIAL PRIMARY KEY,
  entity TEXT NOT NULL CHECK (entity IN ('drawings', 'mindmaps', 'pages')),
  entity_id UUID NOT NULL,
  update_bytes BYTEA NOT NULL,
  -- Tab-scoped client id (the provider's internal identifier). Useful
  -- only for debugging / potential echo-suppression on reload.
  client_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary read pattern: "all updates for a given entity, in order".
CREATE INDEX IF NOT EXISTS idx_yjs_updates_entity_order
  ON public.yjs_updates(entity, entity_id, id);

ALTER TABLE public.yjs_updates ENABLE ROW LEVEL SECURITY;

-- ───────────────────────────────────────────────────────────
-- SELECT — anyone who can read the entity can replay its log.
-- ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Read yjs updates if entity is visible" ON public.yjs_updates;
CREATE POLICY "Read yjs updates if entity is visible"
  ON public.yjs_updates FOR SELECT
  USING (
    (entity = 'drawings' AND EXISTS (
      SELECT 1 FROM public.drawings d WHERE d.id = entity_id
    ))
    OR (entity = 'mindmaps' AND EXISTS (
      SELECT 1 FROM public.mindmaps m WHERE m.id = entity_id
    ))
    OR (entity = 'pages' AND EXISTS (
      SELECT 1 FROM public.pages p WHERE p.id = entity_id
    ))
  );

-- ───────────────────────────────────────────────────────────
-- INSERT — only editors of the entity's workspace can append.
-- Private (is_private = true) items require ownership.
-- ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Append yjs updates if editor of entity" ON public.yjs_updates;
CREATE POLICY "Append yjs updates if editor of entity"
  ON public.yjs_updates FOR INSERT
  WITH CHECK (
    (entity = 'drawings' AND EXISTS (
      SELECT 1 FROM public.drawings d
      WHERE d.id = entity_id
        AND public.user_has_workspace_access(d.workspace_id, 'editor')
        AND (d.is_private = false OR d.created_by = auth.uid())
    ))
    OR (entity = 'mindmaps' AND EXISTS (
      SELECT 1 FROM public.mindmaps m
      WHERE m.id = entity_id
        AND public.user_has_workspace_access(m.workspace_id, 'editor')
        AND (m.is_private = false OR m.created_by = auth.uid())
    ))
    OR (entity = 'pages' AND EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = entity_id
        AND public.user_has_workspace_access(p.workspace_id, 'editor')
        AND (p.is_private = false OR p.created_by = auth.uid())
    ))
  );

-- ───────────────────────────────────────────────────────────
-- DELETE — same gate as INSERT (needed for compaction).
-- ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Delete yjs updates during compaction" ON public.yjs_updates;
CREATE POLICY "Delete yjs updates during compaction"
  ON public.yjs_updates FOR DELETE
  USING (
    (entity = 'drawings' AND EXISTS (
      SELECT 1 FROM public.drawings d
      WHERE d.id = entity_id
        AND public.user_has_workspace_access(d.workspace_id, 'editor')
        AND (d.is_private = false OR d.created_by = auth.uid())
    ))
    OR (entity = 'mindmaps' AND EXISTS (
      SELECT 1 FROM public.mindmaps m
      WHERE m.id = entity_id
        AND public.user_has_workspace_access(m.workspace_id, 'editor')
        AND (m.is_private = false OR m.created_by = auth.uid())
    ))
    OR (entity = 'pages' AND EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = entity_id
        AND public.user_has_workspace_access(p.workspace_id, 'editor')
        AND (p.is_private = false OR p.created_by = auth.uid())
    ))
  );

COMMIT;
