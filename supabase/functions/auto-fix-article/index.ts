import { fetchWithBackoff } from "../_shared/backoff.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SECTIONS = ["Background", "Key Details", "Quotes", "Why it matters", "Outlook"] as const;
type Section = typeof SECTIONS[number];

function extractSection(body: string, name: string): string {
  const re = new RegExp(`^##\\s*${name}\\s*$([\\s\\S]*?)(?=^##\\s|\\Z)`, "im");
  const m = body.match(re);
  return (m?.[1] || "").trim();
}

function replaceSection(body: string, name: string, newContent: string): string {
  const re = new RegExp(`(^##\\s*${name}\\s*$)([\\s\\S]*?)(?=^##\\s|$)`, "im");
  const block = `## ${name}\n\n${newContent.trim()}\n\n`;
  if (re.test(body)) return body.replace(re, block.trimEnd() + "\n\n");
  // Insert at end if missing
  return body.trimEnd() + "\n\n" + block;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { headline, lede, body, template_type, sources, issues } = await req.json();
    if (!body && !headline) throw new Error("Missing draft content");

    // Decide which sections to regenerate from issue ids
    const issueIds: string[] = (issues || []).map((i: { id: string }) => i.id);
    const targets = new Set<Section>();
    for (const id of issueIds) {
      if (id.startsWith("heading-")) {
        const name = id.replace("heading-", "");
        if ((SECTIONS as readonly string[]).includes(name)) targets.add(name as Section);
      }
      if (id === "background-weak") targets.add("Background");
      if (id === "why-weak") targets.add("Why it matters");
      if (id === "outlook-weak") targets.add("Outlook");
      if (id === "quotes-count" || id.startsWith("attribution-")) targets.add("Quotes");
      if (id === "paragraphs" || id === "wordcount") {
        targets.add("Background"); targets.add("Why it matters"); targets.add("Outlook");
      }
    }
    const refreshSources = issueIds.includes("sources-missing") || issueIds.includes("sources-notes") || targets.size > 0;
    const sectionsToFix = Array.from(targets);
    if (sectionsToFix.length === 0 && !refreshSources) {
      return new Response(JSON.stringify({ success: true, sections: {}, sources: sources || [], note: "Nothing to fix" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existing: Record<string, string> = {};
    for (const s of SECTIONS) existing[s] = extractSection(body || "", s);

    const userPrompt = `You are auto-fixing an Amaica Media article. Regenerate ONLY the requested sections.
Do NOT invent facts beyond what is in the existing draft or the provided sources/notes. Stay tight and specific.

HEADLINE: ${headline}
LEDE: ${lede || ""}
TEMPLATE: ${template_type || "breaking"}

EXISTING FULL BODY:
${(body || "").slice(0, 6000)}

EXISTING SECTIONS:
${SECTIONS.map((s) => `### ${s}\n${existing[s] || "(empty)"}`).join("\n\n")}

EXISTING SOURCES:
${JSON.stringify(sources || [], null, 2)}

SECTIONS TO REGENERATE: ${sectionsToFix.length ? sectionsToFix.join(", ") : "(none — just refresh sources)"}

RULES:
- Each regenerated section: 2–3 paragraphs, plain markdown (no heading, just paragraphs separated by blank lines).
- Quotes section MUST contain at least two attributed direct quotes using straight double quotes — for example, "the announcement is overdue," said Jane Mwangi, the festival director. If the source content has no quotes, paraphrase with attribution like: Mwangi told Amaica Media the festival would expand.
- Why it matters: spell out impact for Western Kenya / Kenyan audience — venues, ticket access, scene growth.
- Outlook: forward-looking — what's next, when, where.
- Background: 12–24 months of context.
- Key Details: who, what, when, where, how much, how many. No filler.
- NO hype words (amazing, incredible, stunning, slayed, shook, absolutely).
- REFRESH sources: keep existing URLs, but ensure every source has 2–4 short factual notes (names, dates, prices, venues, quotes). Add any URLs already named in the body that are missing.

Return STRICT JSON via the tool.`;

    const reqBody = JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a senior entertainment editor doing surgical rewrites. Do not invent facts. Output only what the tool schema asks for." },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "apply_fixes",
            description: "Return regenerated sections and refreshed sources",
            parameters: {
              type: "object",
              properties: {
                sections: {
                  type: "object",
                  description: "Map of section name to regenerated markdown paragraphs (no heading prefix). Only include sections you regenerated.",
                  properties: {
                    "Background": { type: "string" },
                    "Key Details": { type: "string" },
                    "Quotes": { type: "string" },
                    "Why it matters": { type: "string" },
                    "Outlook": { type: "string" },
                  },
                  additionalProperties: false,
                },
                sources: {
                  type: "array",
                  description: "Full refreshed sources list. Each source has url, title, and 2-4 short factual notes.",
                  items: {
                    type: "object",
                    properties: {
                      url: { type: "string" },
                      title: { type: "string" },
                      notes: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            text: { type: "string" },
                            section: { type: "string", enum: ["Background", "Key Details", "Quotes", "Why it matters", "Outlook", ""] },
                          },
                          required: ["text", "section"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["url", "title", "notes"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["sections", "sources"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "apply_fixes" } },
    });
    const { response: aiRes } = await fetchWithBackoff(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: reqBody,
      },
      { maxAttempts: 4, baseMs: 1000, capMs: 8000 },
    );
    if (!aiRes) throw new Error("AI gateway unreachable");

    if (!aiRes.ok) {
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit reached." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Lovable AI credits required." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway ${aiRes.status}: ${await aiRes.text()}`);
    }
    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return structured output");
    const fix = JSON.parse(toolCall.function.arguments);

    // Apply section replacements
    let newBody = body || "";
    const applied: string[] = [];
    for (const [name, content] of Object.entries(fix.sections || {})) {
      if (typeof content === "string" && content.trim() && (SECTIONS as readonly string[]).includes(name)) {
        newBody = replaceSection(newBody, name, content as string);
        applied.push(name);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      body: newBody,
      sections_updated: applied,
      sources: fix.sources || sources || [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("auto-fix-article error:", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});