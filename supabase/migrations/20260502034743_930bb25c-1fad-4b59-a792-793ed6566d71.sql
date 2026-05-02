CREATE TABLE public.scrape_failures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_url TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,
  last_status_code INTEGER,
  last_error TEXT,
  fail_count INTEGER NOT NULL DEFAULT 0,
  last_failed_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scrape_failures_domain ON public.scrape_failures(domain);
CREATE INDEX idx_scrape_failures_last_failed ON public.scrape_failures(last_failed_at DESC);

ALTER TABLE public.scrape_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors and admins view scrape failures"
ON public.scrape_failures FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage scrape failures"
ON public.scrape_failures FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_scrape_failures_updated_at
BEFORE UPDATE ON public.scrape_failures
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Domain blocklist for Firecrawl-unsupported sites
CREATE TABLE public.scrape_blocklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scrape_blocklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view blocklist"
ON public.scrape_blocklist FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins manage blocklist"
ON public.scrape_blocklist FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed common Firecrawl-unsupported domains
INSERT INTO public.scrape_blocklist (domain, reason) VALUES
  ('facebook.com', 'Firecrawl does not support Facebook'),
  ('www.facebook.com', 'Firecrawl does not support Facebook'),
  ('m.facebook.com', 'Firecrawl does not support Facebook'),
  ('instagram.com', 'Firecrawl does not support Instagram'),
  ('www.instagram.com', 'Firecrawl does not support Instagram'),
  ('twitter.com', 'Firecrawl does not support Twitter/X'),
  ('x.com', 'Firecrawl does not support Twitter/X'),
  ('tiktok.com', 'Firecrawl does not support TikTok'),
  ('www.tiktok.com', 'Firecrawl does not support TikTok'),
  ('youtube.com', 'Firecrawl does not support YouTube'),
  ('www.youtube.com', 'Firecrawl does not support YouTube'),
  ('youtu.be', 'Firecrawl does not support YouTube');

-- Enable pg_cron + pg_net for scheduled discovery
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;