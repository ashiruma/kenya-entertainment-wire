import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Masthead } from "@/components/Masthead";
import { useAuth } from "@/lib/auth";

type Item = { id: string; headline: string; category: string | null; region: string; published_at: string | null; hero_image_url: string | null };

export default function Published() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("drafts").select("id, headline, category, region, published_at, hero_image_url")
      .eq("status", "published").order("published_at", { ascending: false })
      .then(({ data }) => setItems((data as Item[]) || []));
  }, [user]);

  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Masthead variant="newsroom" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <div className="label-eyebrow text-primary mb-1">Newsroom · Published</div>
          <h1 className="font-display text-3xl">Live on Amaica</h1>
        </div>
        <div className="bg-card border border-border rounded shadow-card divide-y divide-border">
          {items.length === 0 ? (
            <div className="p-8 text-center text-ink-light">Nothing published yet.</div>
          ) : items.map((d) => (
            <Link key={d.id} to={`/article/${d.id}`} className="block p-4 hover:bg-muted">
              <div className="text-[10px] uppercase tracking-widest text-primary mb-1">{d.category} {d.region === "western_kenya" && "· Western KE"}</div>
              <h2 className="font-display text-lg">{d.headline}</h2>
              <div className="text-[11px] text-ink-light mt-1">{d.published_at ? new Date(d.published_at).toLocaleString() : ""}</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}