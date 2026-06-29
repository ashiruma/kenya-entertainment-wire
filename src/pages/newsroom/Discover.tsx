import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Masthead } from "@/components/Masthead";
import { useAuth } from "@/lib/auth";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { RefreshCw, Sparkles, MapPin, Clock, ExternalLink, Eye, X, Square, CheckSquare } from "lucide-react";

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPreview, setBulkPreview] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  type RetryStatus = {
    state: "queued" | "writing" | "retrying" | "done" | "failed";
    attempts?: number;
    nextRetryAt?: string | null;
    finalStatus?: number | null;
    finalError?: string | null;
  };
  const [retryStatus, setRetryStatus] = useState<Record<string, RetryStatus>>({});

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

  // Live-poll write_article_attempts for the currently-writing story so the bulk
  // preview modal can show attempt count + next retry time as they happen.
  useEffect(() => {
    if (!writingId) return;
    const key = `wa:${writingId}`;
    const t = setInterval(async () => {
      const { data } = await supabase
        .from("write_article_attempts")
        .select("attempt,status,http_code,error,next_retry_at,finished_at")
        .eq("idempotency_key", key)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return;
      setRetryStatus((prev) => {
        const cur = prev[writingId];
        if (cur?.state === "done" || cur?.state === "failed") return prev;
        return {
          ...prev,
          [writingId]: {
            state: data.status === "rate_limited" || (data.status === "error" && !data.finished_at) ? "retrying" : (cur?.state ?? "writing"),
            attempts: data.attempt,
            nextRetryAt: data.next_retry_at,
            finalStatus: data.http_code,
            finalError: data.error,
          },
        };
      });
    }, 1500);
    return () => clearInterval(t);
  }, [writingId]);

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

  const writeDraft = async (story: Story, opts?: { skipNavigate?: boolean }) => {
    setWritingId(story.id);
    const idempotency_key = `wa:${story.id}`;
    setRetryStatus((prev) => ({ ...prev, [story.id]: { state: "writing", attempts: 0 } }));
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
          idempotency_key,
          story_id: story.id,
        },
      });
      // Capture retry telemetry whether or not the call succeeded
      const retry = (data as { retry?: { attempts?: number; final_status?: number | null; final_error?: string | null } } | null)?.retry;
      if (error || !data?.article) {
        setRetryStatus((prev) => ({
          ...prev,
          [story.id]: {
            state: "failed",
            attempts: retry?.attempts,
            finalStatus: retry?.final_status ?? null,
            finalError: retry?.final_error ?? (error?.message || "Writing failed"),
          },
        }));
        throw error || new Error(retry?.final_error || "Writing failed");
      }
      const a = data.article;
      // Idempotent insert: if a draft already exists for this key, reuse it instead of duplicating.
      const { data: existing } = await supabase.from("drafts")
        .select("id").eq("idempotency_key", idempotency_key).maybeSingle();
      let draft = existing as { id: string } | null;
      if (!draft) {
        const { data: inserted, error: dErr } = await supabase.from("drafts").insert({
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
        idempotency_key,
        sources: (a.sources && a.sources.length > 0)
          ? a.sources
          : [{ url: story.source_url, title: story.source, notes: story.excerpt ? [story.excerpt.slice(0, 300)] : [] }],
        }).select().single();
        if (dErr) {
          // Conflict on idempotency_key → fetch existing draft
          if ((dErr as { code?: string }).code === "23505") {
            const { data: dup } = await supabase.from("drafts")
              .select("id").eq("idempotency_key", idempotency_key).maybeSingle();
            if (!dup) throw dErr;
            draft = dup as { id: string };
          } else {
            throw dErr;
          }
        } else {
          draft = inserted as { id: string };
        }
      }
      await supabase.from("discovered_stories").update({ status: "used" }).eq("id", story.id);
      setStories((prev) => prev.filter((x) => x.id !== story.id));
      setRetryStatus((prev) => ({
        ...prev,
        [story.id]: { state: "done", attempts: retry?.attempts ?? 1 },
      }));
      if (!opts?.skipNavigate) {
        toast.success("Draft created");
        navigate(`/newsroom/draft/${draft!.id}`);
      }
    } catch (e) {
      if (!opts?.skipNavigate) toast.error(e instanceof Error ? e.message : "Writing failed");
      setRetryStatus((prev) => {
        const cur = prev[story.id];
        if (cur?.state === "failed") return prev;
        return { ...prev, [story.id]: { state: "failed", finalError: e instanceof Error ? e.message : "Writing failed" } };
      });
      throw e;
    } finally {
      setWritingId(null);
    }
  };

  const skip = async (id: string) => {
    await supabase.from("discovered_stories").update({ status: "skipped" }).eq("id", id);
    setStories(stories.filter((s) => s.id !== id));
  };

  const filtered = filter === "all" ? stories : stories.filter((s) => s.region === filter);
  const selectedStories = filtered.filter((s) => selected.has(s.id));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const selectAllVisible = () => {
    if (filtered.length > 0 && filtered.every((s) => selected.has(s.id))) setSelected(new Set());
    else setSelected(new Set(filtered.map((s) => s.id)));
  };
  const bulkDraft = async () => {
    if (selectedStories.length === 0) return;
    await runDraftBatch(selectedStories);
  };

  const retryFailed = async () => {
    const failedIds = Object.entries(retryStatus)
      .filter(([, r]) => r.state === "failed")
      .map(([id]) => id);
    const toRetry = stories.filter((s) => failedIds.includes(s.id));
    if (toRetry.length === 0) {
      toast.message("Nothing to retry");
      return;
    }
    await runDraftBatch(toRetry);
  };

  const runDraftBatch = async (batch: Story[]) => {
    setBulkProgress({ done: 0, total: batch.length });
    setRetryStatus((prev) => {
      const next = { ...prev };
      for (const s of batch) next[s.id] = { state: "queued" };
      return next;
    });
    let ok = 0, fail = 0;
    for (const s of batch) {
      try { await writeDraft(s, { skipNavigate: true }); ok++; }
      catch { fail++; }
      setBulkProgress((p) => p ? { ...p, done: p.done + 1 } : p);
    }
    setBulkProgress(null);
    // Keep the preview open if anything failed so the editor can see the reasons.
    if (fail === 0) {
      setSelected(new Set());
      setBulkPreview(false);
    }
    toast.success(`Created ${ok} draft${ok === 1 ? "" : "s"}${fail ? ` · ${fail} failed` : ""}`);
    if (fail === 0 && batch.length > 1) navigate("/newsroom/drafts");
  };

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

        {filtered.length > 0 && (
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap bg-muted/40 border border-border rounded px-3 py-2">
            <button onClick={selectAllVisible} className="text-xs flex items-center gap-1.5 text-ink-mid hover:text-foreground">
              {filtered.every((s) => selected.has(s.id)) ? <CheckSquare size={14} /> : <Square size={14} />}
              {selected.size > 0 ? `${selected.size} selected` : "Select all visible"}
            </button>
            {selected.size > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setBulkPreview(true)} className="text-xs px-3 py-1.5 rounded bg-foreground text-background flex items-center gap-1.5">
                  <Eye size={12} /> Preview {selected.size}
                </button>
                <button
                  onClick={bulkDraft}
                  disabled={!!bulkProgress}
                  className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles size={12} />
                  {bulkProgress ? `Drafting ${bulkProgress.done}/${bulkProgress.total}…` : `Draft ${selected.size} selected`}
                </button>
                <button onClick={() => setSelected(new Set())} className="text-xs text-ink-light hover:text-destructive px-2">Clear</button>
              </div>
            )}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-ink-light">
            <p className="mb-3">No leads yet.</p>
            <button onClick={discover} className="text-primary underline text-sm">Run discovery</button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => (
              <article key={s.id} className={`bg-card border rounded shadow-card p-5 flex gap-4 animate-fade-in-up ${selected.has(s.id) ? "border-primary" : "border-border"}`}>
                <label className="flex items-start pt-1 cursor-pointer">
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="mt-1" />
                </label>
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

      {bulkPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setBulkPreview(false)}>
          <div className="bg-background rounded shadow-card max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 p-5 border-b border-border sticky top-0 bg-background">
              <div>
                <div className="label-eyebrow text-primary mb-1">Bulk preview</div>
                <h2 className="font-display text-xl">{selectedStories.length} stories selected</h2>
                <p className="text-xs text-ink-light mt-1">Review highlights, then create drafts for all in one click.</p>
              </div>
              <button onClick={() => setBulkPreview(false)} className="text-ink-light hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {selectedStories.map((s) => (
                <div key={s.id} className="border border-border rounded p-4">
                  <div className="flex items-center gap-2 mb-1 text-[11px]">
                    <span className="font-mono-amaica text-primary uppercase tracking-wider">{s.source}</span>
                    {s.region === "western_kenya" && <span className="bg-accent text-accent-foreground px-1.5 py-0.5 rounded-sm">Western KE</span>}
                    {retryStatus[s.id] && (() => {
                      const r = retryStatus[s.id];
                      const cls = r.state === "done" ? "bg-green-100 text-green-800"
                        : r.state === "failed" ? "bg-red-100 text-red-800"
                        : r.state === "retrying" ? "bg-amber-100 text-amber-800"
                        : "bg-gray-100 text-gray-800";
                      const label = r.state === "writing" ? "Writing…"
                        : r.state === "retrying" ? `Retrying (attempt ${r.attempts ?? "?"})${r.nextRetryAt ? ` · next ${new Date(r.nextRetryAt).toLocaleTimeString()}` : ""}`
                        : r.state === "done" ? `Drafted${r.attempts && r.attempts > 1 ? ` · ${r.attempts} attempts` : ""}`
                        : r.state === "failed" ? `Failed${r.finalStatus ? ` ${r.finalStatus}` : ""}${r.attempts ? ` · ${r.attempts} attempts` : ""}`
                        : "Queued";
                      return (
                        <span className={`px-1.5 py-0.5 rounded-sm ${cls}`} title={r.finalError ?? ""}>{label}</span>
                      );
                    })()}
                  </div>
                  <h3 className="font-display text-base leading-snug mb-1">{s.title}</h3>
                  {s.preview_summary && <p className="text-xs text-ink-mid mb-2 line-clamp-3">{s.preview_summary}</p>}
                  {s.highlights && s.highlights.length > 0 && (
                    <ul className="text-xs space-y-1 mt-2">
                      {s.highlights.slice(0, 3).map((h, i) => <li key={i} className="border-l-2 border-primary pl-2 text-ink-mid">{h}</li>)}
                    </ul>
                  )}
                  {retryStatus[s.id]?.finalError && (
                    <div className="mt-2 text-[11px] text-destructive">{retryStatus[s.id].finalError}</div>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-2 pt-2 border-t border-border sticky bottom-0 bg-background py-3">
                <button
                  onClick={bulkDraft}
                  disabled={!!bulkProgress}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium hover:bg-primary-mid flex items-center gap-2 disabled:opacity-50"
                >
                  <Sparkles size={14} />
                  {bulkProgress ? `Drafting ${bulkProgress.done}/${bulkProgress.total}…` : `Create ${selectedStories.length} drafts`}
                </button>
                <button onClick={() => setBulkPreview(false)} className="text-sm text-ink-light hover:text-foreground px-3 py-2">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}