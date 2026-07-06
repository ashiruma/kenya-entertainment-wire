import { defineMcp } from "@lovable.dev/mcp-js";
import listLatestArticles from "./tools/list-latest-articles";
import getArticle from "./tools/get-article";
import listLegends from "./tools/list-legends";

export default defineMcp({
  name: "amaica-media-mcp",
  title: "Amaica Media MCP",
  version: "0.1.0",
  instructions:
    "Tools for Amaica Media, a Western Kenya-focused entertainment newsroom. Use `list_latest_articles` to browse recent published stories, `get_article` for the full body of a specific article, and `list_legends` to explore the 'Our Legends' roster.",
  tools: [listLatestArticles, getArticle, listLegends],
});