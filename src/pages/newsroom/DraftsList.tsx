import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Masthead } from "@/components/Masthead";
import { useAuth } from "@/lib/auth";
import { FileText } from "lucide-react";

type Draft = {
  id: string;
  headline: string;
  category: string | null;
  region: string;
  status: string;
  template_type: string;
  updated_at: string;
};

export default function DraftsList() {
  const { user, loading } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [showPublished, setShowPublished] = useState(false);

  useEffect(() => {
    if (!user) return;
    let q = supabase
      .from("drafts")
      .select("id, headline, category, region, status, template_type, updated_at")
      .order("updated_at", { ascending: false });
    if (!showPublished) q = q.neq("status", "published");
    q.then(({ data }) => setDrafts(data || []));
  }, [user, showPublished]);

  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Masthead variant="newsroom" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div className="label-eyebrow text-primary mb-1">Newsroom · Drafts</div>
            <h1 className="font-display text-3xl">Working stories</h1>
          </div>
          <label className="flex items-center gap-2 text-xs text-ink-mid">
            <input type="checkbox" checked={showPublished} onChange={(e) => setShowPublished(e.target.checked)} />
            Include published (edit live posts)
          </label>
        </div>

        {drafts.length === 0 ? (
          <div className="text-center py-16 text-ink-light">
            <FileText size={32} className="mx-auto mb-3 opacity-40" />
            <p>No drafts yet. Head to <Link to="/newsroom" className="text-primary underline">Discover</Link> to create one.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded shadow-card divide-y divide-border">
            {drafts.map((d) => (
              <Link key={d.id} to={`/newsroom/draft/${d.id}`} className="block p-4 hover:bg-muted transition">
                <div className="flex items-center gap-2 mb-1 text-[10px] uppercase tracking-widest">
                  <span className={`px-2 py-0.5 rounded-sm font-medium ${d.status === "review" ? "bg-accent text-accent-foreground" : "bg-teal-light text-primary"}`}>{d.status}</span>
                  <span className="text-ink-light">{d.template_type}</span>
                  {d.category && <span className="text-ink-light">· {d.category}</span>}
                  {d.region === "western_kenya" && <span className="text-destructive">· Western KE</span>}
                </div>
                <h2 className="font-display text-lg leading-snug">{d.headline}</h2>
                <div className="text-[11px] text-ink-light mt-1">Updated {new Date(d.updated_at).toLocaleString()}</div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}