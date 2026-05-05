import { useEffect, useState } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Masthead } from "@/components/Masthead";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Save, Send, Trash2, Twitter, Instagram, Facebook, Image as ImageIcon, RefreshCw, Globe, ExternalLink } from "lucide-react";

type Draft = {
  id: string;
  author_id: string;
  headline: string;
  lede: string | null;
  body: string | null;
  category: string | null;
  region: string;
  template_type: string;
  hero_image_url: string | null;
  social_image_url: string | null;
  byline: string | null;
  twitter_post: string | null;
  instagram_post: string | null;
  facebook_post: string | null;
  status: string;
  wordpress_post_url: string | null;
};

export default function DraftEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading, isEditor } = useAuth();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [wpBusy, setWpBusy] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    supabase.from("drafts").select("*").eq("id", id).single().then(({ data, error }) => {
      if (error) toast.error(error.message);
      else setDraft(data as Draft);
    });
  }, [id, user]);

  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!draft) return <div className="min-h-screen bg-background"><Masthead variant="newsroom" /><div className="p-8 text-ink-light">Loading…</div></div>;

  const update = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });

  const save = async (newStatus?: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("drafts").update({
        headline: draft.headline,
        lede: draft.lede,
        body: draft.body,
        category: draft.category,
        byline: draft.byline,
        hero_image_url: draft.hero_image_url,
        social_image_url: draft.social_image_url,
        twitter_post: draft.twitter_post,
        instagram_post: draft.instagram_post,
        facebook_post: draft.facebook_post,
        ...(newStatus ? { status: newStatus, ...(newStatus === "published" ? { published_at: new Date().toISOString() } : {}) } : {}),
      }).eq("id", draft.id);
      if (error) throw error;
      toast.success(newStatus === "published" ? "Published live" : newStatus === "review" ? "Sent for review" : "Saved");
      if (newStatus) setDraft({ ...draft, status: newStatus });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const findNewImage = async () => {
    if (!draft) return;
    setImgBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("find-image", {
        body: { query: draft.headline, headline: draft.headline },
      });
      if (error) throw error;
      if (data?.success && data?.image?.url) {
        update({ hero_image_url: data.image.url, social_image_url: data.image.url });
        toast.success(`Image found from ${data.image.source}`);
      } else {
        toast.error("No alternative image found");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Image search failed");
    } finally {
      setImgBusy(false);
    }
  };

  const setCustomImage = () => {
    const url = prompt("Paste image URL", draft?.hero_image_url || "");
    if (url) update({ hero_image_url: url, social_image_url: url });
  };

  const publishToWordPress = async () => {
    if (!draft) return;
    setWpBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("publish-wordpress", {
        body: {
          headline: draft.headline,
          body: draft.body,
          lede: draft.lede,
          byline: draft.byline,
          hero_image_url: draft.hero_image_url,
          status: "publish",
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "WordPress publish failed");
      await supabase.from("drafts").update({
        wordpress_post_url: data.post_url,
        wordpress_post_id: String(data.post_id),
        wordpress_published_at: new Date().toISOString(),
      }).eq("id", draft.id);
      setDraft({ ...draft, wordpress_post_url: data.post_url });
      toast.success("Published to WordPress");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "WordPress publish failed");
    } finally {
      setWpBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this draft permanently?")) return;
    await supabase.from("drafts").delete().eq("id", draft.id);
    toast.success("Deleted");
    navigate("/newsroom/drafts");
  };

  return (
    <div className="min-h-screen bg-background">
      <Masthead variant="newsroom" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest mb-1">
            <span className={`px-2 py-0.5 rounded-sm font-medium ${draft.status === "published" ? "bg-primary text-primary-foreground" : draft.status === "review" ? "bg-accent text-accent-foreground" : "bg-teal-light text-primary"}`}>{draft.status}</span>
            <span className="text-ink-light">{draft.template_type} · {draft.region.replace("_", " ")}</span>
          </div>

          <div>
            <label className="label-eyebrow block mb-1">Headline</label>
            <textarea value={draft.headline} onChange={(e) => update({ headline: e.target.value })} rows={2} className="w-full font-display text-2xl leading-tight bg-card border border-border rounded px-3 py-2 resize-none" />
          </div>

          <div>
            <label className="label-eyebrow block mb-1">Byline</label>
            <input
              value={draft.byline || ""}
              onChange={(e) => update({ byline: e.target.value })}
              placeholder="By Jane Mwangi"
              className="w-full text-sm bg-card border border-border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="label-eyebrow block mb-1">Lede</label>
            <textarea value={draft.lede || ""} onChange={(e) => update({ lede: e.target.value })} rows={2} className="w-full text-base bg-card border border-border rounded px-3 py-2 resize-none" />
          </div>

          <div>
            <label className="label-eyebrow block mb-1">Body (markdown)</label>
            <textarea value={draft.body || ""} onChange={(e) => update({ body: e.target.value })} rows={20} className="w-full text-sm font-mono bg-card border border-border rounded px-3 py-2 resize-y leading-relaxed" />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button disabled={busy} onClick={() => save()} className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium hover:bg-primary-mid transition flex items-center gap-1.5 disabled:opacity-50">
              <Save size={14} /> Save
            </button>
            {draft.status === "draft" && (
              <button disabled={busy} onClick={() => save("review")} className="bg-accent text-accent-foreground px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
                Send for review
              </button>
            )}
            {draft.status !== "published" && (
              <button disabled={busy} onClick={() => save("published")} className="bg-destructive text-destructive-foreground px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition flex items-center gap-1.5 disabled:opacity-50">
                <Send size={14} /> {isEditor ? "Publish" : "Self-publish"}
              </button>
            )}
            <button disabled={wpBusy} onClick={publishToWordPress} className="bg-foreground text-background px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition flex items-center gap-1.5 disabled:opacity-50">
              <Globe size={14} /> {wpBusy ? "Pushing…" : "Publish to WordPress"}
            </button>
            <button onClick={remove} className="ml-auto text-destructive hover:bg-red-light px-3 py-2 rounded text-sm flex items-center gap-1.5">
              <Trash2 size={14} /> Delete
            </button>
          </div>
          {draft.wordpress_post_url && (
            <a href={draft.wordpress_post_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              <ExternalLink size={11} /> View on WordPress
            </a>
          )}
        </div>

        <aside className="space-y-4">
          <div className="bg-card border border-border rounded p-4 shadow-card">
            <div className="label-eyebrow mb-2 flex items-center gap-1.5"><ImageIcon size={11} /> Hero / social image</div>
            {draft.hero_image_url ? (
              <img src={draft.hero_image_url} alt="" className="w-full aspect-[16/10] object-cover rounded border border-border mb-2" onError={(e) => (e.currentTarget.style.opacity = "0.3")} />
            ) : (
              <div className="w-full aspect-[16/10] bg-muted rounded border border-border mb-2 flex items-center justify-center text-xs text-ink-light">No image</div>
            )}
            <input
              value={draft.hero_image_url || ""}
              onChange={(e) => update({ hero_image_url: e.target.value, social_image_url: e.target.value })}
              placeholder="https://…"
              className="w-full text-[11px] bg-muted border border-border rounded px-2 py-1.5 mb-2"
            />
            <div className="flex gap-1.5">
              <button disabled={imgBusy} onClick={findNewImage} className="flex-1 bg-primary text-primary-foreground px-2 py-1.5 rounded text-[11px] font-medium hover:bg-primary-mid disabled:opacity-50 flex items-center justify-center gap-1">
                <RefreshCw size={10} className={imgBusy ? "animate-spin" : ""} /> Find photo
              </button>
              <button onClick={setCustomImage} className="bg-muted text-foreground px-2 py-1.5 rounded text-[11px] font-medium hover:bg-border">Paste URL</button>
            </div>
            <p className="text-[10px] text-ink-light mt-2">This image will be attached to all social posts and pushed to WordPress.</p>
          </div>
          <div className="bg-card border border-border rounded p-4 shadow-card">
            <div className="label-eyebrow mb-2 flex items-center gap-1.5"><Twitter size={11} /> Twitter / X</div>
            {draft.social_image_url && <img src={draft.social_image_url} alt="" className="w-full aspect-video object-cover rounded mb-2 border border-border" />}
            <textarea value={draft.twitter_post || ""} onChange={(e) => update({ twitter_post: e.target.value })} rows={4} maxLength={280} className="w-full text-xs bg-muted border border-border rounded px-2 py-1.5 resize-none" />
            <div className="text-[10px] text-ink-light mt-1 text-right">{(draft.twitter_post || "").length}/280</div>
          </div>
          <div className="bg-card border border-border rounded p-4 shadow-card">
            <div className="label-eyebrow mb-2 flex items-center gap-1.5"><Instagram size={11} /> Instagram</div>
            {draft.social_image_url && <img src={draft.social_image_url} alt="" className="w-full aspect-square object-cover rounded mb-2 border border-border" />}
            <textarea value={draft.instagram_post || ""} onChange={(e) => update({ instagram_post: e.target.value })} rows={5} className="w-full text-xs bg-muted border border-border rounded px-2 py-1.5 resize-none" />
          </div>
          <div className="bg-card border border-border rounded p-4 shadow-card">
            <div className="label-eyebrow mb-2 flex items-center gap-1.5"><Facebook size={11} /> Facebook</div>
            {draft.social_image_url && <img src={draft.social_image_url} alt="" className="w-full aspect-[1.91/1] object-cover rounded mb-2 border border-border" />}
            <textarea value={draft.facebook_post || ""} onChange={(e) => update({ facebook_post: e.target.value })} rows={4} className="w-full text-xs bg-muted border border-border rounded px-2 py-1.5 resize-none" />
          </div>
        </aside>
      </main>
    </div>
  );
}