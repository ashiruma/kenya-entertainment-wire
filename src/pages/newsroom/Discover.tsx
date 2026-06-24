import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Masthead } from "@/components/Masthead";
import { useAuth } from "@/lib/auth";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { RefreshCw, Sparkles, MapPin, Clock, ExternalLink, Eye, X } from "lucide-react";

type Story = {
  id: string;
  title: string;
  source: string;
  source_url: string;
  excerpt: string | null;
  image_url: string | null;
  region: string;
  category: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  highlights?: string[] | null;
  preview_summary?: string | null;
};

export default function Discover() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stories, setStories] = useState<Story[]>([]);
  const [filter, setFilter] = useState<"all" | "western_kenya" | "national">("all");
  const [discovering, setDiscovering] = useState(false);
  const [writingId, setWritingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Story | null>(null);

  const load = async () => {
    let q = supabase
      .from("discovered_stories")
      .select("*")
      .eq("status", "new")
      .order("region", { ascending: true })
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(60);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setStories((data || []) as unknown as Story[]);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) return <Navigate to="/auth" replace />;

  const discover = async () => {
    setDiscovering(true);
    try {
      const { data, error } = await supabase.functions.invoke("discover-news");
      if (error) throw error;
      toast.success(`Found ${data?.inserted ?? 0} new stories`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Discovery failed");
    } finally {
      setDiscovering(false);
    }
  };

  const writeDraft = async (story: Story) => {
    setWritingId(story.id);
    try {
      // Try deep-scrape; on Firecrawl 403/402/etc fall back to RSS title + excerpt
      let content = story.excerpt || "";
      let usedFallback = false;
      try {
        const { data: scrape } = await supabase.functions.invoke("scrape-article", {
          body: { story_id: story.id, url: story.source_url },
        });
        if (scrape?.success && scrape?.content) {
          content = scrape.content;
        } else if (scrape?.fallback) {
          usedFallback = true;
          // Compose richest available context from RSS (title + excerpt + image hint)
          content = [story.title, story.excerpt].filter(Boolean).join("\n\n");
        }
      } catch {
        usedFallback = true;
      }
      if (usedFallback) {
        toast.message("Using RSS excerpt", { description: "Source page couldn't be scraped — drafting from feed data." });
      }

      // If RSS didn't supply a hero image, try alternative photo sources
      let heroImage = story.image_url;
      if (!heroImage) {
        try {
          const { data: img } = await supabase.functions.invoke("find-image", {
            body: { query: story.title, headline: story.title },
          });
          if (img?.success && img?.image?.url) heroImage = img.image.url;
        } catch { /* non-fatal */ }
      }

      const { data, error } = await supabase.functions.invoke("write-article", {
        body: {
          source_title: story.title,
          source_excerpt: story.excerpt,
          source_content: content,
          source_name: story.source,
          template_type: "breaking",
          region: story.region,
        },
      });
      if (error) throw error;
      const a = data.article;
      const { data: draft, error: dErr } = await supabase.from("drafts").insert({
        author_id: user.id,
        source_story_id: story.id,
        template_type: a.template_used,
        headline: a.headline,
        lede: a.lede,
        body: a.body,
        category: a.category,
        region: story.region,
        hero_image_url: heroImage,
        social_image_url: heroImage,
        byline: user.user_metadata?.display_name || user.email?.split("@")[0] || "Amaica Newsroom",
        twitter_post: a.twitter_post,
        instagram_post: a.instagram_post,
        facebook_post: a.facebook_post,
        status: "draft",
        sources: (a.sources && a.sources.length > 0)
          ? a.sources
          : [{ url: story.source_url, title: story.source, notes: story.excerpt ? [story.excerpt.slice(0, 300)] : [] }],
      }).select().single();
      if (dErr) throw dErr;
      await supabase.from("discovered_stories").update({ status: "used" }).eq("id", story.id);
      toast.success("Draft created");
      navigate(`/newsroom/draft/${draft.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Writing failed");
    } finally {
      setWritingId(null);
    }
  };

  const skip = async (id: string) => {
    await supabase.from("discovered_stories").update({ status: "skipped" }).eq("id", id);
    setStories(stories.filter((s) => s.id !== id));
  };

  const filtered = filter === "all" ? stories : stories.filter((s) => s.region === filter);

  return (
    <div className="min-h-screen bg-background">
      <Masthead variant="newsroom" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div>
            <div className="label-eyebrow text-primary mb-1">Newsroom · Discover</div>
            <h1 className="font-display text-3xl mb-1">Story leads</h1>
            <p className="text-sm text-ink-light">Western Kenya first. Click to draft an Amaica-style article.</p>
          </div>
          <button onClick={discover} disabled={discovering} className="bg-primary text-primary-foreground px-4 py-2.5 rounded text-sm font-medium hover:bg-primary-mid transition flex items-center gap-2 disabled:opacity-50">
            <RefreshCw size={14} className={discovering ? "animate-spin" : ""} />
            {discovering ? "Scanning feeds..." : "Discover new stories"}
          </button>
        </div>

        <div className="flex gap-1 mb-6 border-b border-border">
          {([
            ["all", "All"],
            ["western_kenya", "Western Kenya"],
            ["national", "National"],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={`px-4 py-2 text-[13px] border-b-2 -mb-px transition ${filter === key ? "border-primary text-primary font-medium" : "border-transparent text-ink-light hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-ink-light">
            <p className="mb-3">No leads yet.</p>
            <button onClick={discover} className="text-primary underline text-sm">Run discovery</button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => (
              <article key={s.id} className="bg-card border border-border rounded shadow-card p-5 flex gap-4 animate-fade-in-up">
                {s.image_url && (
                  <img src={s.image_url} alt="" className="w-32 h-24 object-cover rounded flex-shrink-0 hidden sm:block" onError={(e) => (e.currentTarget.style.display = "none")} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 text-[11px]">
                    <span className="font-mono-amaica text-primary uppercase tracking-wider">{s.source}</span>
                    {s.region === "western_kenya" && (
                      <span className="bg-accent text-accent-foreground px-1.5 py-0.5 rounded-sm font-medium flex items-center gap-1">
                        <MapPin size={10} /> Western KE
                      </span>
                    )}
                    <span className="text-ink-light flex items-center gap-1">
                      <Clock size={10} />
                      {s.published_at ? new Date(s.published_at).toLocaleDateString() : "—"}
                    </span>
                  </div>
                  <h2 className="font-display text-lg leading-snug mb-1.5">{s.title}</h2>
                  {s.excerpt && <p className="text-sm text-ink-mid line-clamp-2 mb-3">{s.excerpt}</p>}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setPreview(s)}
                      className="bg-foreground text-background px-3 py-1.5 rounded text-xs font-medium hover:opacity-90 transition flex items-center gap-1.5"
                    >
                      <Eye size={12} /> Preview
                    </button>
                    <button
                      onClick={() => writeDraft(s)}
                      disabled={writingId === s.id}
                      className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-xs font-medium hover:bg-primary-mid transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Sparkles size={12} />
                      {writingId === s.id ? "Writing..." : "Write Amaica draft"}
                    </button>
                    <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-ink-light hover:text-primary px-2 py-1.5 flex items-center gap-1">
                      <ExternalLink size={11} /> Source
                    </a>
                    <button onClick={() => skip(s.id)} className="text-xs text-ink-light hover:text-destructive px-2 py-1.5">Skip</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-background rounded shadow-card max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 p-5 border-b border-border sticky top-0 bg-background">
              <div>
                <div className="label-eyebrow text-primary mb-1">Discovery preview</div>
                <h2 className="font-display text-xl leading-snug">{preview.title}</h2>
                <div className="text-xs text-ink-light mt-1 flex items-center gap-2 flex-wrap">
                  <span className="font-mono-amaica uppercase tracking-wider text-primary">{preview.source}</span>
                  {preview.region === "western_kenya" && <span className="bg-accent text-accent-foreground px-1.5 py-0.5 rounded-sm">Western KE</span>}
                  {preview.published_at && <span>{new Date(preview.published_at).toLocaleString()}</span>}
                </div>
              </div>
              <button onClick={() => setPreview(null)} className="text-ink-light hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {preview.image_url && <img src={preview.image_url} alt="" className="w-full rounded" />}
              {preview.preview_summary && (
                <div>
                  <div className="label-eyebrow text-primary mb-1">Summary</div>
                  <p className="text-sm text-ink-mid leading-relaxed">{preview.preview_summary}</p>
                </div>
              )}
              {preview.highlights && preview.highlights.length > 0 && (
                <div>
                  <div className="label-eyebrow text-primary mb-1">Extracted highlights</div>
                  <ul className="space-y-1.5 text-sm">
                    {preview.highlights.map((h, i) => (
                      <li key={i} className="border-l-2 border-primary pl-3">{h}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(!preview.highlights || preview.highlights.length === 0) && preview.excerpt && (
                <div>
                  <div className="label-eyebrow text-primary mb-1">Excerpt</div>
                  <p className="text-sm text-ink-mid leading-relaxed">{preview.excerpt}</p>
                </div>
              )}
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <button
                  onClick={() => { const s = preview; setPreview(null); writeDraft(s); }}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium hover:bg-primary-mid flex items-center gap-2"
                >
                  <Sparkles size={14} /> Proceed to draft
                </button>
                <a href={preview.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-ink-light hover:text-primary flex items-center gap-1 px-3 py-2">
                  <ExternalLink size={12} /> Open source
                </a>
                <button onClick={() => { skip(preview.id); setPreview(null); }} className="text-sm text-ink-light hover:text-destructive px-3 py-2">Skip</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}