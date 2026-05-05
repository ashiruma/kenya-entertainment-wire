// Publish a draft to WordPress.com via the connector gateway.
// Uploads the hero image to the WP media library first, then creates the post.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/wordpress_com";

function gwHeaders(lovKey: string, wpKey: string, extra: Record<string, string> = {}) {
  return {
    "Authorization": `Bearer ${lovKey}`,
    "X-Connection-Api-Key": wpKey,
    ...extra,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const WORDPRESS_COM_API_KEY = Deno.env.get("WORDPRESS_COM_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!WORDPRESS_COM_API_KEY) throw new Error("WORDPRESS_COM_API_KEY is not configured");

    const { site_id, headline, body, lede, byline, hero_image_url, category, status } = await req.json();
    if (!headline || !body) throw new Error("headline and body required");

    // 1. Resolve site id — if not supplied, pick the first site the user has.
    let siteId = (site_id || "").toString().trim();
    if (!siteId) {
      const sitesRes = await fetch(`${GATEWAY}/rest/v1.2/me/sites?fields=ID,URL,name`, {
        headers: gwHeaders(LOVABLE_API_KEY, WORDPRESS_COM_API_KEY),
      });
      const sitesJson = await sitesRes.json();
      if (!sitesRes.ok) throw new Error(`WP sites ${sitesRes.status}: ${JSON.stringify(sitesJson)}`);
      const first = sitesJson.sites?.[0];
      if (!first) throw new Error("No WordPress sites available on this account");
      siteId = String(first.ID);
    }

    // 2. Upload hero image (optional)
    let featuredImageId: number | undefined;
    if (hero_image_url) {
      try {
        const imgRes = await fetch(hero_image_url);
        if (imgRes.ok) {
          const buf = new Uint8Array(await imgRes.arrayBuffer());
          const ct = imgRes.headers.get("content-type") || "image/jpeg";
          const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
          const filename = `amaica-${Date.now()}.${ext}`;
          const fd = new FormData();
          fd.append("media[]", new Blob([buf as BlobPart], { type: ct }), filename);
          const upRes = await fetch(`${GATEWAY}/rest/v1.1/sites/${siteId}/media/new`, {
            method: "POST",
            headers: gwHeaders(LOVABLE_API_KEY, WORDPRESS_COM_API_KEY),
            body: fd,
          });
          const upJson = await upRes.json();
          if (upRes.ok) {
            featuredImageId = upJson.media?.[0]?.ID;
          } else {
            console.warn("WP media upload failed:", upJson);
          }
        }
      } catch (e) {
        console.warn("hero image fetch failed:", e);
      }
    }

    // 3. Build content HTML — markdown-ish to HTML paragraphs
    const paragraphs = (body as string).split(/\n\n+/).map((p) => `<p>${p.replace(/^#+\s*/, "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`).join("\n");
    const bylineHtml = byline ? `<p><em>By ${byline}</em></p>` : "";
    const ledeHtml = lede ? `<p><strong>${lede}</strong></p>` : "";
    const content = `${bylineHtml}${ledeHtml}${paragraphs}`;

    const postBody: Record<string, unknown> = {
      title: headline,
      content,
      status: status === "draft" ? "draft" : "publish",
    };
    if (featuredImageId) postBody.featured_image = featuredImageId;
    if (category) postBody.categories = category;

    const postRes = await fetch(`${GATEWAY}/rest/v1.2/sites/${siteId}/posts/new`, {
      method: "POST",
      headers: gwHeaders(LOVABLE_API_KEY, WORDPRESS_COM_API_KEY, { "Content-Type": "application/json" }),
      body: JSON.stringify(postBody),
    });
    const postJson = await postRes.json();
    if (!postRes.ok) throw new Error(`WP create post ${postRes.status}: ${JSON.stringify(postJson)}`);

    return new Response(JSON.stringify({
      success: true,
      post_url: postJson.URL,
      post_id: postJson.ID,
      site_id: siteId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("publish-wordpress error:", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});