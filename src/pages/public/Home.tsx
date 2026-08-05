import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Masthead } from "@/components/Masthead";
import { Search } from "lucide-react";
import { LegendOfDay } from "@/components/LegendOfDay";

type Article = {
  id: string;
  headline: string;
  lede: string | null;
  category: string | null;
  region: string;
  hero_image_url: string | null;
  published_at: string | null;
};

export default function PublicHome() {
  const { category } = useParams<{ category?: string }>();
  const [articles, setArticles] = useState<Article[]>([]);
  const [region, setRegion] = useState<"all" | "western_kenya" | "national" | "world">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let q = supabase
      .from("drafts")
      .select("id, headline, lede, category, region, hero_image_url, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(30);
    if (category) q = q.eq("category", category);
    q.then(({ data }) => setArticles((data as Article[]) || []));
  }, [category]);

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      if (region !== "all" && a.region !== region) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (!`${a.headline} ${a.lede ?? ""} ${a.category ?? ""}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [articles, region, query]);

  const isFiltering = region !== "all" || query.trim().length > 0 || !!category;
  const hero = !isFiltering ? articles[0] : undefined;
  const western = articles.filter((a) => a.region === "western_kenya").slice(0, 4);
  const list = isFiltering ? filtered : articles.slice(1);

  return (
    <div className="min-h-screen bg-background">
      <Masthead variant="public" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {!category && <LegendOfDay />}
        {category && (
          <div className="mb-6">
            <div className="label-eyebrow text-primary mb-1">Section</div>
            <h1 className="font-display text-3xl capitalize">{category}</h1>
          </div>
        )}

        {/* Filter bar */}
        <div className="mb-6 flex flex-wrap items-center gap-3 bg-card border border-border rounded p-3">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={14} className="text-ink-light" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search headlines, ledes, topics…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-light"
            />
          </div>
          <div className="flex gap-1 text-[12px]">
            {([
              ["all", "All regions"],
              ["western_kenya", "Western Kenya"],
              ["national", "National"],
              ["world", "World"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setRegion(k)}
                className={`px-3 py-1.5 rounded transition ${region === k ? "bg-primary text-primary-foreground" : "text-ink-light hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {(query || region !== "all") && (
            <button onClick={() => { setQuery(""); setRegion("all"); }} className="text-[12px] text-destructive hover:underline">Clear</button>
          )}
        </div>

        {hero && (
          <Link to={`/article/${hero.id}`} className="block mb-10 group">
            <div className="grid md:grid-cols-[1.4fr_1fr] gap-6 items-center bg-card border border-border rounded shadow-elevated overflow-hidden">
              <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                {hero.hero_image_url ? (
                  <img src={hero.hero_image_url} alt={hero.headline} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                ) : (
                  <div className="w-full h-full bg-primary flex items-center justify-center font-display text-primary-foreground/30 text-6xl">A</div>
                )}
                <div className="absolute top-3 left-3 bg-destructive text-destructive-foreground text-[10px] font-medium tracking-widest uppercase px-2 py-1">Top Story</div>
              </div>
              <div className="p-6">
                <div className="label-eyebrow text-primary mb-2">{hero.category} {hero.region === "western_kenya" && "· Western Kenya"}</div>
                <h2 className="font-display text-3xl md:text-4xl leading-tight mb-3 group-hover:text-primary transition">{hero.headline}</h2>
                <p className="text-ink-mid leading-relaxed line-clamp-3">{hero.lede}</p>
              </div>
            </div>
          </Link>
        )}

        {articles.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded">
            <div className="label-eyebrow text-primary mb-2">No stories yet</div>
            <h2 className="font-display text-2xl mb-3">The desk is warming up.</h2>
            <p className="text-sm text-ink-light mb-5">Sign in to the newsroom to discover and write your first story.</p>
            <Link to="/newsroom" className="inline-block bg-primary text-primary-foreground px-5 py-2 rounded text-sm font-medium hover:bg-primary-mid transition">Open Newsroom</Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_300px] gap-8">
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px bg-border flex-1" />
                <h2 className="label-eyebrow text-primary">
                  {isFiltering ? `${list.length} ${list.length === 1 ? "result" : "results"}` : "Latest"}
                </h2>
                <div className="h-px bg-border flex-1" />
              </div>
              {list.length === 0 ? (
                <p className="text-center text-sm text-ink-light py-10">No stories match your filters.</p>
              ) : (
              <div className="grid sm:grid-cols-2 gap-6">
                {list.map((a) => (
                  <Link key={a.id} to={`/article/${a.id}`} className="group">
                    <div className="aspect-[16/10] bg-muted overflow-hidden mb-3 rounded">
                      {a.hero_image_url ? (
                        <img src={a.hero_image_url} alt={a.headline} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full bg-teal-light flex items-center justify-center font-display text-primary/30 text-4xl">A</div>
                      )}
                    </div>
                    <div className="label-eyebrow text-primary mb-1">{a.category} {a.region === "western_kenya" && "· Western KE"}</div>
                    <h3 className="font-display text-xl leading-snug group-hover:text-primary transition mb-1">{a.headline}</h3>
                    <p className="text-sm text-ink-light line-clamp-2">{a.lede}</p>
                  </Link>
                ))}
              </div>
              )}
            </section>
            {!category && (
              <aside>
                <div className="bg-card border border-border rounded p-5 shadow-card sticky top-24">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                    <div className="w-1 h-5 bg-destructive" />
                    <h3 className="font-display text-lg">Western Kenya Desk</h3>
                  </div>
                  {western.length === 0 ? (
                    <p className="text-sm text-ink-light">No regional stories yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {western.map((a, i) => (
                        <li key={a.id} className="pb-3 border-b border-border last:border-0 last:pb-0">
                          <Link to={`/article/${a.id}`} className="group flex gap-2">
                            <span className="font-display text-2xl text-accent leading-none">{i + 1}</span>
                            <span className="text-sm group-hover:text-primary transition leading-snug">{a.headline}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </aside>
            )}
          </div>
        )}
      </main>
      <footer className="bg-primary text-primary-foreground/70 mt-20 py-10">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="font-display text-xl text-primary-foreground mb-2">Amaica <span className="text-accent">MEDIA</span></div>
          <p className="text-xs">Newsroom of Western Kenya · Entertainment desk</p>
        </div>
      </footer>
    </div>
  );
}