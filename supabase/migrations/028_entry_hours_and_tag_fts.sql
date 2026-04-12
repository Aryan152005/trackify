-- Work entries: add `hours_worked` field, and include tag names in the FTS
-- tsvector so searching for a tag name returns entries with that tag.

-- 1. hours_worked column (NUMERIC allows fractional hours like 1.5)
ALTER TABLE public.work_entries
  ADD COLUMN IF NOT EXISTS hours_worked NUMERIC(5, 2);

-- 2. tags_text — denormalised string of tag names for this entry. Maintained by
-- the trigger below whenever entry_tags rows change. Included in search_tsv.
ALTER TABLE public.work_entries
  ADD COLUMN IF NOT EXISTS tags_text TEXT DEFAULT '';

-- 3. Rebuild the generated search_tsv column to include tags_text (weight B)
-- and continue weighting title/description/work_done/learning as before.
ALTER TABLE public.work_entries DROP COLUMN IF EXISTS search_tsv;

ALTER TABLE public.work_entries ADD COLUMN search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(work_done, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(learning, '')), 'C') ||
    setweight(to_tsvector('simple',  coalesce(tags_text, '')),   'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS work_entries_search_tsv_idx
  ON public.work_entries USING GIN (search_tsv);

-- 4. Trigger to keep tags_text in sync whenever entry_tags changes.
CREATE OR REPLACE FUNCTION public.refresh_work_entry_tags_text(_entry_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.work_entries
    SET tags_text = COALESCE((
      SELECT string_agg(t.name, ' ' ORDER BY t.name)
        FROM public.entry_tags et
        JOIN public.tags t ON t.id = et.tag_id
       WHERE et.entry_id = _entry_id
    ), '')
  WHERE id = _entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_entry_tags_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_work_entry_tags_text(OLD.entry_id);
    RETURN OLD;
  ELSE
    PERFORM public.refresh_work_entry_tags_text(NEW.entry_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS entry_tags_refresh_tagstext ON public.entry_tags;
CREATE TRIGGER entry_tags_refresh_tagstext
  AFTER INSERT OR UPDATE OR DELETE ON public.entry_tags
  FOR EACH ROW EXECUTE FUNCTION public.on_entry_tags_change();

-- 5. Backfill tags_text for existing entries.
UPDATE public.work_entries we
  SET tags_text = COALESCE((
    SELECT string_agg(t.name, ' ' ORDER BY t.name)
      FROM public.entry_tags et
      JOIN public.tags t ON t.id = et.tag_id
     WHERE et.entry_id = we.id
  ), '');
