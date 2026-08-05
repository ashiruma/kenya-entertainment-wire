ALTER TABLE public.discovery_feeds ADD COLUMN IF NOT EXISTS region text;

INSERT INTO public.discovery_feeds (name, kind, url, region, enabled, priority, weight)
VALUES
 ('Variety', 'rss', 'https://variety.com/feed/', 'world', true, 5, 1),
 ('The Hollywood Reporter', 'rss', 'https://www.hollywoodreporter.com/feed/', 'world', true, 5, 1),
 ('Deadline', 'rss', 'https://deadline.com/feed/', 'world', true, 5, 1),
 ('Billboard', 'rss', 'https://www.billboard.com/feed/', 'world', true, 5, 1),
 ('Rolling Stone', 'rss', 'https://www.rollingstone.com/feed/', 'world', true, 4, 1),
 ('Pitchfork', 'rss', 'https://pitchfork.com/feed/feed-news/rss', 'world', true, 4, 1),
 ('BBC Entertainment & Arts', 'rss', 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', 'world', true, 5, 1),
 ('Guardian Culture', 'rss', 'https://www.theguardian.com/culture/rss', 'world', true, 4, 1),
 ('NME', 'rss', 'https://www.nme.com/feed', 'world', true, 3, 1),
 ('Screen Daily', 'rss', 'https://www.screendaily.com/rss', 'world', true, 3, 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.discovery_feeds (name, kind, query, region, enabled, priority, weight)
VALUES
 ('World: music news today', 'query', 'world music industry news today album tour -politics -election', 'world', true, 3, 1),
 ('World: film & TV news today', 'query', 'global film tv streaming entertainment news today -politics -election', 'world', true, 3, 1),
 ('World: celebrity news today', 'query', 'international celebrity entertainment news today -politics -election', 'world', true, 3, 1)
ON CONFLICT DO NOTHING;