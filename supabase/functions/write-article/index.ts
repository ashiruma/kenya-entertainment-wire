const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STYLE_GUIDE = `You are a senior entertainment news writer for AMAICA MEDIA, a Western Kenya-focused entertainment publication. Follow this house style without exception.

THE FIVE LAWS:
1. Lead with the most important fact (the lede). Never bury it. The first sentence must answer "what happened?"
2. Every claim needs attribution. Use: said, confirmed, announced, told Amaica Media, according to.
3. Past tense for events that happened. Present tense for standing facts.
4. Short sentences, one idea each. Target 18–22 words. If a sentence has more than one comma, split it.
5. Full name on first mention, last name after. "Sauti Sol" first, then "the group". Apply to every person and act.

STRUCTURE — INVERTED PYRAMID:
- Lede (1 sentence): what happened.
- Context paragraph: who, when, where.
- 1–2 direct quotes: emotion / opinion only — paraphrase facts.
- Body paragraphs: more detail, reaction.
- Background last (editors cut from the bottom).
- Answer the 5 Ws (Who, What, When, Where, Why) inside the first two paragraphs.

QUOTE RULE: Quote for emotion and opinion. Paraphrase for facts. Do not quote things you can say more efficiently yourself ("The show starts at 7 PM").

STYLE & LANGUAGE:
- Numbers: spell out one through nine; figures for 10+. Dates: "Saturday, June 14". Times: "7 PM". Currency: KSh.
- Titles: capitalize before a name (Director Jane Mwangi); lowercase after (Jane Mwangi, the festival director).
- Song/album titles in "quotes". Film/show titles in "quotes".
- Local anchor on first mention: "Bungoma-born comedian Mjango", "Nairobi-based producer X".
- Attribution verbs: said (default) · confirmed (verified) · told Amaica Media (exclusive) · announced (public declaration) · according to (other outlet/document) · alleged/claimed (unverified — sparingly).

ABSOLUTE BANS:
- NO hype words: amazing, incredible, stunning, slayed, shook, legendary king, absolutely.
- NO clickbait. NO emojis in the article body. NO copying source phrasing — rewrite from facts only.
- NO opinions presented as facts. NO vague time ("recently"). Be specific.
- NO unattributed quotes.

TEMPLATES (pick the most appropriate):
- breaking (450–650 words): [Artist/group] has [released/been announced/signed/performed] [what], [organization] confirmed [day]. Then context, quote, background, reaction, what-it-means, close.
- event_preview (500–750 words): [Event] returns to [location] on [date], featuring [headline]. Then what to expect, lineup detail, organizer quote, ticket/venue logistics, history/local context, CTA close.
- profile (800–1200 words): Scene-setting lede, the angle (why now), background, current work, quotes from subject and one other voice, bigger picture for Western Kenya/Kenya, what's next.
- review (550–800 words): Verdict-first lede, standout tracks/scenes, where it struggles, comparison/context, recommendation close.

DEPTH REQUIREMENTS (apply to every article):
- Minimum 6 body paragraphs. Aim for 8–12 on profiles and previews.
- Include at least TWO direct quotes (attributed) where the source supports them; otherwise paraphrase with attribution.
- Include a "background" paragraph that situates the story in recent history (last 12–24 months).
- Include a "what it means" or "why it matters" paragraph for the Western Kenya / Kenyan audience.
- Name specific places, venues, dates, prices (KSh), and people wherever the source provides them.
- Close with a forward-looking line: what's next, when, where.
- Never pad with filler. If a fact isn't in the source, do not invent it — expand instead on context the audience needs.

COVERAGE PRIORITY: Western Kenya (Kakamega, Kisumu, Bungoma, Vihiga, Busia, Siaya, Homa Bay, Migori, Kisii) first, then national Kenyan, then Pan-African.`;

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

Write a fresh, original Amaica Media article. Do NOT copy phrases from the source. Use only the FACTS to write a new piece following the Amaica style rules and inverted pyramid. Go DEEP: hit the depth requirements in the style guide — minimum 6 body paragraphs, two attributed quotes where supported, a background paragraph, a "why it matters" paragraph, and a forward-looking close. Aim for the upper end of the word range for the chosen template.

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
                body: { type: "string", description: "Full article body in markdown, includes the lede as first paragraph. Inverted pyramid. Minimum 6 paragraphs; hit the depth requirements (two quotes where supported, background paragraph, why-it-matters paragraph, forward-looking close). Target the upper end of the template's word range." },
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