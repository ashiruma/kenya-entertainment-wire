// Discover entertainment news from Kenyan RSS feeds + optional Firecrawl deep-scrape
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Curated Kenyan entertainment RSS feeds. Western Kenya focus is applied via region tagging.
const FEEDS = [
  { url: "https://www.pulselive.co.ke/entertainment/rss", source: "Pulse Live Kenya" },
  { url: "https://mpasho.co.ke/feed/", source: "Mpasho" },
  { url: "https://www.standardmedia.co.ke/rss/entertainment.php", source: "Standard SDE" },
  { url: "https://nation.africa/kenya/rss.xml", source: "Nation Africa" },
  { url: "https://citizen.digital/feed", source: "Citizen Digital" },
];

const WESTERN_KENYA_KEYWORDS = [
  "kakamega", "kisumu", "bungoma", "vihiga", "busia", "siaya", "homa bay", "migori",
  "western kenya", "nyanza", "luhya", "luo", "kisii", "mumias",
];

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function pick(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decodeEntities(m[1]).trim() : null;
}

function pickImage(xml: string): string | null {
  // Try common patterns
  const m1 = xml.match(/<media:content[^>]+url="([^"]+)"/i);
  if (m1) return m1[1];
  const m2 = xml.match(/<enclosure[^>]+url="([^"]+)"/i);
  if (m2) return m2[1];
  const m3 = xml.match(/<img[^>]+src="([^"]+)"/i);
  if (m3) return m3[1];
  return null;
}

function detectRegion(text: string): string {
  const lower = text.toLowerCase();
  return WESTERN_KENYA_KEYWORDS.some((k) => lower.includes(k)) ? "western_kenya" : "national";
}

async function fetchFeed(url: string, source: string) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AmaicaMedia/1.0 (+https://amaica.media)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
    return itemBlocks.slice(0, 15).map((block) => {
      const title = stripTags(pick(block, "title") || "");
      const link = (pick(block, "link") || block.match(/<link[^>]+href="([^"]+)"/i)?.[1] || "").trim();
      const desc = stripTags(pick(block, "description") || pick(block, "summary") || pick(block, "content:encoded") || "");
      const pub = pick(block, "pubDate") || pick(block, "published") || pick(block, "updated");
      const image = pickImage(block);
      const blob = `${title} ${desc}`;
      return {
        title,
        source,
        source_url: link,
        excerpt: desc.slice(0, 400),
        image_url: image,
        category: "entertainment",
        region: detectRegion(blob),
        published_at: pub ? new Date(pub).toISOString() : null,
      };
    }).filter((i) => i.title && i.source_url);
  } catch (e) {
    console.error(`Feed error ${url}:`, e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch all feeds in parallel
    const results = await Promise.all(FEEDS.map((f) => fetchFeed(f.url, f.source)));
    const items = results.flat();

    // Filter to entertainment-ish keywords (very loose) and de-dupe
    const ent = /(music|song|album|artist|concert|festival|film|movie|tv|drama|celeb|actor|actress|singer|rapper|dj|netflix|show|premiere|award|nomin|tour|gospel|gengetone|bongo|afrobeat)/i;
    const seen = new Set<string>();
    const filtered = items.filter((i) => {
      if (seen.has(i.source_url)) return false;
      seen.add(i.source_url);
      const looksEntertainment = ent.test(`${i.title} ${i.excerpt}`) || /entertainment|sde|buzz|pulse/i.test(i.source);
      return looksEntertainment;
    });

    // Sort: Western Kenya first, then by date
    filtered.sort((a, b) => {
      if (a.region !== b.region) return a.region === "western_kenya" ? -1 : 1;
      const da = a.published_at ? new Date(a.published_at).getTime() : 0;
      const db = b.published_at ? new Date(b.published_at).getTime() : 0;
      return db - da;
    });

    const top = filtered.slice(0, 40);

    // Upsert (ignore duplicates via unique source_url)
    let inserted = 0;
    for (const item of top) {
      const { error } = await supabase
        .from("discovered_stories")
        .insert(item);
      if (!error) inserted++;
    }

    return new Response(
      JSON.stringify({ success: true, fetched: items.length, filtered: filtered.length, inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("discover-news error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});