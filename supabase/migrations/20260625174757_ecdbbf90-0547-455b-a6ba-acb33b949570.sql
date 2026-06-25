
ALTER TABLE public.discovery_feeds
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weight numeric NOT NULL DEFAULT 1.0;

ALTER TABLE public.discovered_stories
  ADD COLUMN IF NOT EXISTS canonical_url text,
  ADD COLUMN IF NOT EXISTS normalized_title text;

CREATE UNIQUE INDEX IF NOT EXISTS discovered_stories_canonical_url_uniq
  ON public.discovered_stories (canonical_url)
  WHERE canonical_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS discovered_stories_norm_title_created_idx
  ON public.discovered_stories (normalized_title, created_at DESC)
  WHERE normalized_title IS NOT NULL;
