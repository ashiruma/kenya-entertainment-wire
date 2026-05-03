// Find a relevant photo for an article when the RSS feed didn't supply one.
// Tries (in order): Openverse (CC-licensed, no key), Wikipedia/Wikimedia, Firecrawl image search.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Found = { url: string; source: string; credit?: string; license?: string } | null;

async function tryOpenverse(q: string): Promise<Found> {
  try {
    const res = await fetch(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=5&license_type=all&mature=false`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const j = await res.json();
    const r = (j.results || []).find((x: { url?: string }) => x.url);
    if (!r) return null;
    return { url: r.url, source: "Openverse", credit: r.creator || r.source, license: r.license };
  } catch { return null; }
}

async function tryWikimedia(q: string): Promise<Found> {
  try {
    const res = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=5&gsrnamespace=6&prop=imageinfo&iiprop=url&format=json&origin=*`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const j = await res.json();
    const pages = j?.query?.pages ? Object.values(j.query.pages) as Array<{ imageinfo?: Array<{ url: string }> }> : [];
    for (const p of pages) {
      const url = p.imageinfo?.[0]?.url;
      if (url && /\.(jpg|jpeg|png|webp)$/i.test(url)) {
        return { url, source: "Wikimedia Commons", license: "CC" };
      }
    }
    return null;
  } catch { return null; }
}

async function tryFirecrawlImage(q: string): Promise<Found> {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: q, limit: 5, sources: ["images"] }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const imgs = j.data?.images ?? j.images ?? [];
    const first = (Array.isArray(imgs) ? imgs : []).find((i: { imageUrl?: string; url?: string }) => i.imageUrl || i.url);
    if (!first) return null;
    return { url: first.imageUrl || first.url, source: "Firecrawl", credit: first.title };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { query, headline } = await req.json().catch(() => ({}));
    const q = (query || headline || "").toString().trim();
    if (!q) {
      return new Response(JSON.stringify({ success: false, error: "Missing query" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let found = await tryOpenverse(q);
    if (!found) found = await tryWikimedia(q);
    if (!found) found = await tryFirecrawlImage(q);
    return new Response(JSON.stringify({ success: !!found, image: found }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "unknown" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});