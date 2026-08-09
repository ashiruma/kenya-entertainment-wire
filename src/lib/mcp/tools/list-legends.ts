import { defineTool } from "@lovable.dev/mcp-js";
import { requireAuth, supabaseForUser } from "../supabase";
import { z } from "zod";

export default defineTool({
  name: "list_legends",
  title: "List legends",
  description: "List African entertainment legends in the Amaica 'Our Legends' roster.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(25).describe("How many legends to return."),
    country: z.string().optional().describe("Filter by country name."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, country }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("legends")
      .select("id, name, country, era, field, short_bio, impact, image_url")
      .eq("active", true)
      .order("name")
      .limit(limit);
    if (country) q = q.eq("country", country);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { legends: data ?? [] },
    };
  },
});