
ALTER TABLE public.drafts
  ADD COLUMN IF NOT EXISTS byline text,
  ADD COLUMN IF NOT EXISTS social_image_url text,
  ADD COLUMN IF NOT EXISTS wordpress_post_url text,
  ADD COLUMN IF NOT EXISTS wordpress_post_id text,
  ADD COLUMN IF NOT EXISTS wordpress_published_at timestamptz;
