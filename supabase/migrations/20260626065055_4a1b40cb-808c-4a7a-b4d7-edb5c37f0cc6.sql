
ALTER TABLE public.drafts ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS drafts_idempotency_key_uidx ON public.drafts(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.write_article_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
  run_id uuid NULL,
  story_id uuid NULL,
  user_id uuid NULL,
  attempt int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'started',
  http_code int NULL,
  error text NULL,
  retry_after_ms int NULL,
  next_retry_at timestamptz NULL,
  article jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NULL
);

GRANT SELECT ON public.write_article_attempts TO authenticated;
GRANT ALL ON public.write_article_attempts TO service_role;

ALTER TABLE public.write_article_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors can view attempts"
  ON public.write_article_attempts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'editor'));

CREATE INDEX IF NOT EXISTS waa_idem_idx ON public.write_article_attempts(idempotency_key);
CREATE INDEX IF NOT EXISTS waa_run_idx ON public.write_article_attempts(run_id);
CREATE INDEX IF NOT EXISTS waa_story_idx ON public.write_article_attempts(story_id);
CREATE INDEX IF NOT EXISTS waa_created_idx ON public.write_article_attempts(created_at DESC);
