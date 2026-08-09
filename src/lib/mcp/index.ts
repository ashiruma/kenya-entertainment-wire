import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listLatestArticles from "./tools/list-latest-articles";
import getArticle from "./tools/get-article";
import listLegends from "./tools/list-legends";
import searchArticles from "./tools/search-articles";
import searchNewArticles from "./tools/search-new-articles";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "amaica-media-mcp",
  title: "Amaica Media MCP",
  version: "0.1.0",
  instructions:
    "Tools for Amaica Media, a Western Kenya-focused entertainment newsroom. Use `list_latest_articles` to browse recent published stories, `search_articles` to keyword-search with region scoping (western_kenya / kenya / national / all), `search_new_articles_since` for scheduled polling of newly published stories after a cursor timestamp, `get_article` for the full body and typed metadata of a specific article, and `list_legends` to explore the 'Our Legends' roster.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listLatestArticles, searchArticles, searchNewArticles, getArticle, listLegends],
});