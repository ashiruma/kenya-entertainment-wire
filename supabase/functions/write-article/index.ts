const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STYLE_GUIDE = `You are a senior entertainment news writer for AMAICA MEDIA, a Western Kenya-focused entertainment publication.

ABSOLUTE RULES (Amaica Style):
1. Lead with the most important fact in the first sentence (the lede). Never bury the lede.
2. Every claim needs attribution: said, confirmed, announced, told Amaica Media, according to.
3. Past tense for events that happened, present tense for standing facts.
4. Short sentences. One idea per sentence. Target 18-22 words. If a sentence has more than one comma, split it.
5. Full name on first mention, last name after. "Sauti Sol" first, then "the group".
6. Use the inverted pyramid: most important first, background last.
7. Quote for emotion and opinion. Paraphrase for facts.
8. NO hype words ("amazing", "incredible", "stunning"). NO clickbait. NO emojis in the article body.
9. Amaica covers Western Kenya (Kakamega, Kisumu, Bungoma, Vihiga, Busia, Siaya) first, then national Kenyan, then Pan-African.
10. Write in Kenyan English. Use KSh for currency. Local context matters.

TEMPLATES (pick the most appropriate):
- breaking: Announcement / breaking news (150-300 words)
- event_preview: Concert, festival, premiere preview (200-350 words)
- profile: Artist or personality profile (300-500 words)
- review: Album, film, show review (250-400 words)`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { source_title, source_excerpt, source_content, source_name, template_type, region } = await req.json();

    if (!source_title) throw new Error("Missing source_title");

    const userPrompt = `Rewrite this entertainment news lead in Amaica Media style.

SOURCE: ${source_name || "wire"}
REGION FOCUS: ${region || "national"}
REQUESTED TEMPLATE: ${template_type || "breaking"}

ORIGINAL HEADLINE: ${source_title}

ORIGINAL EXCERPT: ${source_excerpt || "(none)"}

FULL ARTICLE CONTENT:
${(source_content || source_excerpt || "").slice(0, 6000)}

Write a fresh, original Amaica Media article. Do NOT copy phrases from the source. Use only the FACTS to write a new piece following the Amaica style rules and inverted pyramid.

Also produce social posts:
- Twitter/X: max 270 chars, punchy, 1-2 hashtags max
- Instagram: 3-4 short lines + 5 hashtags
- Facebook: 2-3 sentences, conversational, no hashtags

Return STRICT JSON only via the provided tool.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: STYLE_GUIDE },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "publish_article",
            description: "Return the rewritten Amaica Media article and social posts",
            parameters: {
              type: "object",
              properties: {
                headline: { type: "string", description: "Sharp headline, max 80 chars, no clickbait" },
                lede: { type: "string", description: "First sentence answering 'what happened?'" },
                body: { type: "string", description: "Full article body in markdown, includes the lede as first paragraph. Inverted pyramid." },
                category: { type: "string", enum: ["music", "film", "tv", "events", "celebrity", "culture"] },
                template_used: { type: "string", enum: ["breaking", "event_preview", "profile", "review"] },
                twitter_post: { type: "string" },
                instagram_post: { type: "string" },
                facebook_post: { type: "string" },
              },
              required: ["headline", "lede", "body", "category", "template_used", "twitter_post", "instagram_post", "facebook_post"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "publish_article" } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Please wait a moment and retry." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Lovable AI credits required. Add credits in Workspace Settings → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiRes.text();
      throw new Error(`AI gateway ${aiRes.status}: ${t}`);
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return structured output");

    const article = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, article }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("write-article error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});