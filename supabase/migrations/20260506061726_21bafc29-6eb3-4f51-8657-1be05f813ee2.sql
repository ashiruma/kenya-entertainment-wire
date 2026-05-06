ALTER TABLE public.drafts
  ADD COLUMN IF NOT EXISTS auto_publish_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_publish_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS wordpress_last_error text;

CREATE INDEX IF NOT EXISTS idx_drafts_auto_publish
  ON public.drafts (auto_publish_at)
  WHERE auto_publish_enabled = true AND wordpress_post_id IS NULL;