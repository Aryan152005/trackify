-- Migration 021: Full-text search (FTS) support
-- Adds generated tsvector columns and GIN indexes to searchable tables.

-- tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_tasks_search_tsv ON public.tasks USING GIN (search_tsv);

-- work_entries
ALTER TABLE public.work_entries
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(work_done, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(learning, '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_work_entries_search_tsv ON public.work_entries USING GIN (search_tsv);

-- pages (content is JSONB — skip it; just title)
ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, ''))) STORED;
CREATE INDEX IF NOT EXISTS idx_pages_search_tsv ON public.pages USING GIN (search_tsv);

-- reminders
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_reminders_search_tsv ON public.reminders USING GIN (search_tsv);
