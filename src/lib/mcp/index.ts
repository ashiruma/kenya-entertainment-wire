import { defineMcp } from "@lovable.dev/mcp-js";
import listLatestArticles from "./tools/list-latest-articles";
import getArticle from "./tools/get-article";
import listLegends from "./tools/list-legends";
import searchArticles from "./tools/search-articles";

export default defineMcp({
  name: "amaica-media-mcp",
  title: "Amaica Media MCP",
  version: "0.1.0",
  instructions:
    "Tools for Amaica Media, a Western Kenya-focused entertainment newsroom. Use `list_latest_articles` to browse recent published stories, `search_articles` to keyword-search with region scoping (western_kenya / kenya / national / all), `get_article` for the full body and typed metadata of a specific article, and `list_legends` to explore the 'Our Legends' roster.",
  tools: [listLatestArticles, searchArticles, getArticle, listLegends],
});