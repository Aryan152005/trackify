-- Link-sharing security + correctness fixes.
--
-- 1. Add 'challenge' to the allowed entity_type enum. Migration 013 omitted
--    it, but the UI, API route, and viewer page all accept it — any attempt
--    to share a challenge currently throws a 23514 CHECK violation.
-- 2. No schema change for the is_private leak — that's enforced at the
--    server-action + API-route layer since share entity_type is polymorphic
--    and the private column lives on the target table.
-- 3. Backfill: nothing to migrate (no rows could have been inserted with
--    'challenge' given the old constraint).

BEGIN;

-- Drop the old constraint (naming is Postgres's auto-generated form).
ALTER TABLE public.shared_links
  DROP CONSTRAINT IF EXISTS shared_links_entity_type_check;

-- Re-add with the full entity list the app actually supports.
ALTER TABLE public.shared_links
  ADD CONSTRAINT shared_links_entity_type_check
  CHECK (entity_type IN (
    'page',
    'task',
    'board',
    'entry',
    'drawing',
    'mindmap',
    'challenge'
  ));

COMMIT;
