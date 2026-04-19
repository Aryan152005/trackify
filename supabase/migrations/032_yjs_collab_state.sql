-- Yjs CRDT state columns for real-time collab.
--
-- Each collaborative entity (drawing, mindmap, page) now carries a binary
-- Yjs state alongside its existing legacy JSON snapshot. Rationale:
--   - Yjs `encodeStateAsUpdate(doc)` is the authoritative shared state —
--     peers fetch it on join and apply updates as they receive them.
--   - The existing `data` / `nodes` / `content` columns stay populated too
--     (written opportunistically from the Y.Doc on snapshot) so:
--       a) legacy viewers / exports keep working,
--       b) an accidental Y.Doc corruption can be recovered from the JSON.
--
-- Transport is Supabase Realtime broadcast (see SupabaseYjsProvider). No new
-- service is deployed — same stack, CRDT on top.

ALTER TABLE public.drawings
  ADD COLUMN IF NOT EXISTS yjs_state BYTEA;

ALTER TABLE public.mindmaps
  ADD COLUMN IF NOT EXISTS yjs_state BYTEA;

ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS yjs_state BYTEA;

-- No index needed — this column is only ever fetched by primary key.
