import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Masthead } from "@/components/Masthead";
import { ArrowLeft, ExternalLink, Link as LinkIcon } from "lucide-react";
import { noteText, noteSection, type SourceRef } from "@/lib/articleValidation";

type Article = {
  id: string;
  headline: string;
  lede: string | null;
  body: string | null;
  category: string | null;
  region: string;
  hero_image_url: string | null;
  published_at: string | null;
  byline: string | null;
  sources: SourceRef[] | null;
};

export default function PublicArticle() {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from("drafts").select("id, headline, lede, body, category, region, hero_image_url, published_at, byline, sources")
      .eq("id", id).eq("status", "published").maybeSingle()
      .then(({ data }) => { if (data) setArticle(data as unknown as Article); else setNotFound(true); });
  }, [id]);

  if (notFound) return (
    <div className="min-h-screen bg-background">
      <Masthead variant="public" />
      <div className="max-w-2xl mx-auto p-12 text-center text-ink-light">
        Article not found. <Link to="/" className="text-primary underline">Back to home</Link>
      </div>
    </div>
  );

  if (!article) return <div className="min-h-screen bg-background"><Masthead variant="public" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <Masthead variant="public" />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-ink-light hover:text-primary mb-6">
          <ArrowLeft size={12} /> Back
        </Link>
        <div className="label-eyebrow text-primary mb-3">{article.category} {article.region === "western_kenya" && "· Western Kenya"}</div>
        <h1 className="font-display text-4xl md:text-5xl leading-[1.1] mb-4">{article.headline}</h1>
        {article.lede && <p className="text-xl text-ink-mid leading-relaxed mb-6 font-light">{article.lede}</p>}
        <div className="flex items-center gap-3 pb-6 mb-8 border-b border-border text-[11px] font-mono uppercase tracking-wider text-ink-light">
          <span>By {article.byline || "Amaica Newsroom"}</span><span>·</span>
          <span>{article.published_at && new Date(article.published_at).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}</span>
        </div>
        {article.hero_image_url && <img src={article.hero_image_url} alt={article.headline} className="w-full aspect-[16/9] object-cover rounded mb-8" />}
        <article className="max-w-none text-ink-mid">
          {(article.body || "").split(/\n\n+/).map((p, i) => {
            const trimmed = p.trim();
            const h = trimmed.match(/^(#{2,3})\s+(.+)$/);
            if (h) {
              return <h2 key={i} className="font-display text-2xl mt-8 mb-3 text-foreground">{h[2]}</h2>;
            }
            return <p key={i} className="mb-5 leading-relaxed text-[17px]">{trimmed}</p>;
          })}
        </article>

        {article.sources && article.sources.length > 0 && (
          <section className="mt-10 pt-6 border-t border-border">
            <div className="label-eyebrow text-primary flex items-center gap-1.5 mb-3">
              <LinkIcon size={11} /> Sources & verification notes
            </div>
            <ul className="space-y-4">
              {article.sources.map((s, i) => (
                <li key={i} className="text-sm">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    {s.title || s.url} <ExternalLink size={11} />
                  </a>
                  {s.notes && s.notes.length > 0 && (
                    <ul className="mt-1.5 pl-4 list-disc text-xs text-ink-light space-y-0.5">
                      {s.notes.map((n, j) => {
                        const text = noteText(n);
                        const section = noteSection(n);
                        if (!text) return null;
                        return (
                          <li key={j}>
                            {section && <span className="inline-block bg-muted text-foreground text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded mr-1.5 font-mono">{section}</span>}
                            {text}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}