import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Masthead } from "@/components/Masthead";
import { ArrowLeft, Crown } from "lucide-react";

type Feature = {
  id: string;
  feature_date: string;
  headline: string;
  tribute: string;
  hero_image_url: string | null;
  legends: {
    name: string; country: string | null; era: string | null; field: string | null;
    short_bio: string | null; impact: string | null;
  } | null;
};

export default function LegendPage() {
  const { id } = useParams<{ id: string }>();
  const [f, setF] = useState<Feature | null>(null);
  const [archive, setArchive] = useState<Array<{ id: string; headline: string; feature_date: string }>>([]);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("legend_features")
      .select("id, feature_date, headline, tribute, hero_image_url, legends(name, country, era, field, short_bio, impact)")
      .eq("id", id).maybeSingle()
      .then(({ data }) => setF(data as unknown as Feature));
    supabase
      .from("legend_features")
      .select("id, headline, feature_date")
      .order("feature_date", { ascending: false }).limit(10)
      .then(({ data }) => setArchive(data || []));
  }, [id]);

  if (!f) return <div className="min-h-screen bg-background"><Masthead variant="public" /></div>;
  const l = f.legends;

  return (
    <div className="min-h-screen bg-background">
      <Masthead variant="public" />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/" className="text-xs text-ink-light hover:text-primary inline-flex items-center gap-1 mb-4">
          <ArrowLeft size={12} /> Back
        </Link>
        <div className="label-eyebrow text-accent mb-2 inline-flex items-center gap-1">
          <Crown size={12} /> Our Legends · {new Date(f.feature_date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
        </div>
        <h1 className="font-display text-4xl md:text-5xl leading-tight mb-2">{f.headline}</h1>
        {l && (
          <p className="text-sm text-ink-light mb-6">
            {l.name}{l.country ? ` · ${l.country}` : ""}{l.era ? ` · ${l.era}` : ""}{l.field ? ` · ${l.field}` : ""}
          </p>
        )}
        {f.hero_image_url && (
          <img src={f.hero_image_url} alt={l?.name || f.headline} className="w-full aspect-[16/9] object-cover rounded mb-6" />
        )}
        <article
          className="prose max-w-none prose-headings:font-display prose-blockquote:border-accent prose-blockquote:text-primary"
          dangerouslySetInnerHTML={{ __html: f.tribute }}
        />
        {archive.length > 1 && (
          <section className="mt-12 pt-8 border-t border-border">
            <h3 className="label-eyebrow text-primary mb-4">Recent legends</h3>
            <ul className="space-y-2">
              {archive.filter((a) => a.id !== f.id).map((a) => (
                <li key={a.id} className="text-sm">
                  <Link to={`/legends/${a.id}`} className="hover:text-primary transition">
                    <span className="text-ink-light mr-2 font-mono-amaica text-[11px]">{new Date(a.feature_date).toLocaleDateString()}</span>
                    {a.headline}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}