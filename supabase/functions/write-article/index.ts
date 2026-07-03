import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { fetchWithBackoff } from "../_shared/backoff.ts";

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
- breaking (1600+ words): [Artist/group] has [released/been announced/signed/performed] [what], [organization] confirmed [day]. Then context, quote, background, reaction, what-it-means, close.
- event_preview (1600+ words): [Event] returns to [location] on [date], featuring [headline]. Then what to expect, lineup detail, organizer quote, ticket/venue logistics, history/local context, CTA close.
- profile (1600+ words): Scene-setting lede, the angle (why now), background, current work, quotes from subject and one other voice, bigger picture for Western Kenya/Kenya, what's next.
- review (1600+ words): Verdict-first lede, standout tracks/scenes, where it struggles, comparison/context, recommendation close.

DEPTH REQUIREMENTS (apply to every article):
- Minimum 6 body paragraphs across the structured sections. Aim for 8–12 on profiles and previews.
- Include at least TWO direct quotes (in straight double quotes ") with attribution ("…," said Jane Mwangi.) where the source supports them; otherwise paraphrase with attribution.
- Name specific places, venues, dates, prices (KSh), and people wherever the source provides them.
- Never pad with filler. If a fact isn't in the source, do not invent it — expand instead on context the audience needs.

STRUCTURED TEMPLATE — MANDATORY HEADINGS (in this exact order, using H2 markdown "## "):
1. ## Background — last 12–24 months of context that situates the story.
2. ## Key Details — the core facts: who, what, when, where, how much, how many.
3. ## Quotes — at least two attributed direct quotes (or paraphrased with attribution if no source quote exists).
4. ## Why it matters — what this means for the Western Kenya / Kenyan audience.
5. ## Outlook — forward-looking close: what's next, when, where.

The body field MUST contain the lede as a leading paragraph, then ALL FIVE headings above, each followed by 1–3 paragraphs. Do not rename, omit, reorder, or merge the headings.

COVERAGE PRIORITY: Western Kenya (Kakamega, Kisumu, Bungoma, Vihiga, Busia, Siaya, Homa Bay, Migori, Kisii) first, then national Kenyan, then Pan-African.

SOURCES: Always return a sources[] array with the original wire URL (if provided) and any other URLs explicitly named in the source content. For each source, extract 2–4 short bullet notes (the specific facts you used: names, dates, prices, quotes, venues). Editors use these to verify the story.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const {
      source_title, source_excerpt, source_content, source_name, template_type, region,
      idempotency_key: clientKey, story_id, run_id,
    } = body;

    if (!source_title) throw new Error("Missing source_title");

    // Idempotency key: client-provided, else derive from story_id, else hash of source fields.
    const idempotency_key: string =
      (typeof clientKey === "string" && clientKey.trim()) ||
      (story_id ? `story:${story_id}` : `src:${(source_title || "").slice(0, 120)}:${(source_name || "")}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Cache hit: a prior successful attempt for this key — return its article without re-calling AI.
    const { data: priorSuccess } = await supabase
      .from("write_article_attempts")
      .select("article, attempt")
      .eq("idempotency_key", idempotency_key)
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (priorSuccess?.article) {
      return new Response(JSON.stringify({
        success: true, article: priorSuccess.article, idempotency_key,
        retry: { attempts: priorSuccess.attempt ?? 1, cached: true },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Determine next attempt number for this key
    const { count: priorCount } = await supabase
      .from("write_article_attempts")
      .select("id", { count: "exact", head: true })
      .eq("idempotency_key", idempotency_key);
    const startAttempt = (priorCount ?? 0) + 1;

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

Return STRICT JSON only via the provided tool. The body MUST include the five mandatory headings (## Background, ## Key Details, ## Quotes, ## Why it matters, ## Outlook) in that exact order. Include sources[] with the wire URL and extracted notes used.`;

    const requestBody = JSON.stringify({
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
                body: { type: "string", description: "Full article body in markdown. Starts with the lede as the opening paragraph, then MUST contain these five H2 headings in this exact order: '## Background', '## Key Details', '## Quotes', '## Why it matters', '## Outlook'. Each section has 1–3 paragraphs. Minimum 6 paragraphs total. Two attributed direct quotes (straight quotes \") in the Quotes section where the source supports them. Target the upper end of the template's word range." },
                category: { type: "string", enum: ["music", "film", "tv", "events", "celebrity", "culture"] },
                template_used: { type: "string", enum: ["breaking", "event_preview", "profile", "review"] },
                twitter_post: { type: "string" },
                instagram_post: { type: "string" },
                facebook_post: { type: "string" },
                sources: {
                  type: "array",
                  description: "Sources used. Include the original wire URL plus any URLs explicitly named in the content. For each, 2–4 short factual notes extracted from the source.",
                  items: {
                    type: "object",
                    properties: {
                      url: { type: "string" },
                      title: { type: "string" },
                      notes: { type: "array", items: { type: "string" } },
                    },
                    required: ["url", "title", "notes"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["headline", "lede", "body", "category", "template_used", "twitter_post", "instagram_post", "facebook_post", "sources"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "publish_article" } },
    });

    let lastAttemptNum = startAttempt;
    const result = await fetchWithBackoff(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: requestBody,
      },
      {
        maxAttempts: 4, baseMs: 1000, capMs: 8000,
        onRetry: async ({ attempt, status, delayMs, error }) => {
          const n = startAttempt + (attempt - 1);
          lastAttemptNum = n + 1;
          await supabase.from("write_article_attempts").insert({
            idempotency_key, run_id: run_id ?? null, story_id: story_id ?? null,
            attempt: n,
            status: status === 429 ? "rate_limited" : "error",
            http_code: status || null,
            error: error ?? null,
            retry_after_ms: delayMs,
            next_retry_at: new Date(Date.now() + delayMs).toISOString(),
            finished_at: new Date().toISOString(),
          });
        },
      },
    );
    const aiRes = result.response;
    if (!aiRes) {
      await supabase.from("write_article_attempts").insert({
        idempotency_key, run_id: run_id ?? null, story_id: story_id ?? null,
        attempt: lastAttemptNum, status: "error",
        http_code: result.lastStatus, error: result.lastError ?? "no response",
        finished_at: new Date().toISOString(),
      });
      return new Response(JSON.stringify({
        success: false, error: result.lastError ?? "AI gateway unreachable",
        idempotency_key, retry: { attempts: result.attempts, final_status: result.lastStatus, final_error: result.lastError },
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "");
      await supabase.from("write_article_attempts").insert({
        idempotency_key, run_id: run_id ?? null, story_id: story_id ?? null,
        attempt: startAttempt + result.attempts - 1,
        status: aiRes.status === 429 ? "rate_limited" : "error",
        http_code: aiRes.status, error: errText.slice(0, 1000),
        finished_at: new Date().toISOString(),
      });
      const message = aiRes.status === 429
        ? "Rate limit reached. Please wait a moment and retry."
        : aiRes.status === 402
          ? "Lovable AI credits required. Add credits in Workspace Settings → Usage."
          : `AI gateway ${aiRes.status}`;
      return new Response(JSON.stringify({
        success: false, error: message, idempotency_key,
        retry: { attempts: result.attempts, final_status: aiRes.status, final_error: message },
      }), { status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return structured output");

    const article = JSON.parse(toolCall.function.arguments);

    await supabase.from("write_article_attempts").insert({
      idempotency_key, run_id: run_id ?? null, story_id: story_id ?? null,
      attempt: startAttempt + result.attempts - 1,
      status: "success", http_code: 200, article,
      finished_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({
      success: true, article, idempotency_key,
      retry: { attempts: result.attempts, cached: false },
    }), {
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