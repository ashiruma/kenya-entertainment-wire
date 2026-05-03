
ALTER TABLE public.discovered_stories ADD COLUMN IF NOT EXISTS author text;

ALTER TABLE public.scrape_failures ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

CREATE TABLE IF NOT EXISTS public.scrape_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url text NOT NULL,
  domain text NOT NULL,
  status_code integer,
  success boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrape_events_url_time ON public.scrape_events (source_url, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_events_domain_time ON public.scrape_events (domain, created_at DESC);

ALTER TABLE public.scrape_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors and admins view scrape events"
ON public.scrape_events FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage scrape events"
ON public.scrape_events FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
