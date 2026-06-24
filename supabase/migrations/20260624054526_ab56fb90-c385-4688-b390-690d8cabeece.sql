
-- 1. Feeds & queries registry
CREATE TABLE public.discovery_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('rss','query')),
  name TEXT NOT NULL,
  url TEXT,
  query TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_fetched_at TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT,
  last_item_count INTEGER NOT NULL DEFAULT 0,
  total_accepted INTEGER NOT NULL DEFAULT 0,
  total_rejected INTEGER NOT NULL DEFAULT 0,
  total_duplicates INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_feeds TO authenticated;
GRANT ALL ON public.discovery_feeds TO service_role;
ALTER TABLE public.discovery_feeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read feeds" ON public.discovery_feeds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage feeds" ON public.discovery_feeds FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE TRIGGER trg_discovery_feeds_updated BEFORE UPDATE ON public.discovery_feeds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. Discovery runs log
CREATE TABLE public.discovery_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','partial','failed')),
  trigger TEXT NOT NULL DEFAULT 'manual',
  fetched_count INTEGER NOT NULL DEFAULT 0,
  filtered_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  feed_stats JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.discovery_runs TO authenticated;
GRANT ALL ON public.discovery_runs TO service_role;
ALTER TABLE public.discovery_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view runs" ON public.discovery_runs FOR SELECT TO authenticated USING (true);

-- 3. Settings singleton
CREATE TABLE public.discovery_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  enabled BOOLEAN NOT NULL DEFAULT false,
  interval_minutes INTEGER NOT NULL DEFAULT 60 CHECK (interval_minutes >= 5),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.discovery_settings TO authenticated;
GRANT ALL ON public.discovery_settings TO service_role;
ALTER TABLE public.discovery_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view settings" ON public.discovery_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.discovery_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
INSERT INTO public.discovery_settings (id, enabled, interval_minutes) VALUES (true, false, 60) ON CONFLICT DO NOTHING;

-- 4. Dedup + rejection columns on discovered_stories
ALTER TABLE public.discovered_stories
  ADD COLUMN IF NOT EXISTS dedupe_hash TEXT,
  ADD COLUMN IF NOT EXISTS feed_id UUID REFERENCES public.discovery_feeds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS highlights JSONB,
  ADD COLUMN IF NOT EXISTS preview_summary TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_discovered_stories_dedupe ON public.discovered_stories (dedupe_hash) WHERE dedupe_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discovered_stories_feed ON public.discovered_stories (feed_id);

-- 5. Seed feeds + queries
INSERT INTO public.discovery_feeds (kind, name, url) VALUES
  ('rss','Pulse Live Kenya','https://www.pulselive.co.ke/entertainment/rss'),
  ('rss','Mpasho','https://mpasho.co.ke/feed/'),
  ('rss','Standard SDE','https://www.standardmedia.co.ke/rss/entertainment.php'),
  ('rss','Ghafla Kenya','https://www.ghafla.com/ke/feed/'),
  ('rss','Capital FM','https://www.capitalfm.co.ke/entertainment/feed/'),
  ('rss','Bizna Kenya','https://www.bizna.co.ke/category/entertainment/feed/'),
  ('rss','Tuko Entertainment','https://www.tuko.co.ke/entertainment/rss/'),
  ('rss','Nation Life & Style','https://nation.africa/kenya/life-and-style/rss.xml'),
  ('rss','The Star Sasa','https://www.the-star.co.ke/sasa/rss'),
  ('rss','Citizen Digital','https://citizen.digital/entertainment/feed'),
  ('rss','Kenyans.co.ke','https://www.kenyans.co.ke/feeds/entertainment'),
  ('rss','Nairobi News Sleeq','https://www.nairobinews.co.ke/category/sleeq/feed/'),
  ('rss','Hivisasa','https://www.hivisasa.com/feed'),
  ('rss','Kenyan Vibe','https://kenyanvibe.com/feed/'),
  ('rss','NotJustOk','https://notjustok.com/feed/'),
  ('rss','BellaNaija','https://www.bellanaija.com/feed/'),
  ('rss','The Native','https://thenativemag.com/feed/'),
  ('rss','OkayAfrica','https://www.okayafrica.com/rss/'),
  ('rss','Music In Africa','https://music-in-africa.net/magazine/rss.xml');
INSERT INTO public.discovery_feeds (kind, name, query) VALUES
  ('query','Kenya entertainment today','Kenya entertainment celebrity news today -politics -election'),
  ('query','Western Kenya events','Western Kenya music event Kakamega Kisumu Bungoma concert'),
  ('query','Celebrity gossip','Kenyan celebrity gossip showbiz this week'),
  ('query','New music releases','Kenyan new music release song album'),
  ('query','Luhya/Luo artists','Luhya Luo artist musician Kenya'),
  ('query','Film & TV','Kenya film TV show Netflix premiere'),
  ('query','Nairobi nightlife','Nairobi nightlife festival lineup'),
  ('query','Comedy/Podcasts','Kenyan comedian podcast TikTok trending'),
  ('query','Gengetone/Bongo','Gengetone Bongo Afrobeats new release Kenya'),
  ('query','East Africa tours','East Africa music tour Uganda Tanzania Rwanda concert'),
  ('query','Western KE regional','Kisumu Kakamega Bungoma Eldoret event festival lineup'),
  ('query','Luhya gospel/ohangla','Kenyan Luhya gospel benga ohangla new song'),
  ('query','Showmax/Netflix','Showmax Netflix Africa premiere Kenyan cast');
