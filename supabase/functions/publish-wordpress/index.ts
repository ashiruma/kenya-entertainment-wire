// Publish a draft to WordPress.com via the connector gateway.
// Uploads the hero image to the WP media library first, then creates the post.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/wordpress_com";
const DEFAULT_SITE = "theashirumanow.wordpress.com";

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

    // Site is hardcoded (the connection doesn't have the `global` scope to list me/sites).
    const siteId = ((site_id || "").toString().trim()) || DEFAULT_SITE;

    // 2. Upload hero image (optional)
    let featuredImageId: number | undefined;
    if (hero_image_url) {
      try {
        const imgRes = await fetch(hero_image_url);
        if (imgRes.ok) {
          const buf = new Uint8Array(await imgRes.arrayBuffer());
          // Sniff real type from magic bytes — many CDNs return application/octet-stream
          // which WP rejects ("not allowed to upload this file type").
          let mime = "image/jpeg";
          let ext = "jpg";
          if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
            mime = "image/png"; ext = "png";
          } else if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
            mime = "image/jpeg"; ext = "jpg";
          } else if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
            mime = "image/gif"; ext = "gif";
          } else if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
            mime = "image/webp"; ext = "webp";
          } else {
            // Fallback to header-declared type if recognisable
            const ct = (imgRes.headers.get("content-type") || "").toLowerCase();
            if (ct.includes("png")) { mime = "image/png"; ext = "png"; }
            else if (ct.includes("webp")) { mime = "image/webp"; ext = "webp"; }
            else if (ct.includes("gif")) { mime = "image/gif"; ext = "gif"; }
          }
          const filename = `amaica-${Date.now()}.${ext}`;
          const fd = new FormData();
          fd.append("media[]", new Blob([buf as BlobPart], { type: mime }), filename);
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

    // Default to `pending` so editors review on WordPress before going live.
    const allowed = new Set(["draft", "pending", "publish", "private", "future"]);
    const wpStatus = allowed.has(status) ? status : "pending";
    const postBody: Record<string, unknown> = {
      title: headline,
      content,
      status: wpStatus,
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