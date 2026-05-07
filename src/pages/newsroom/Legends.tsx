import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Masthead } from "@/components/Masthead";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Crown, Plus, Sparkles } from "lucide-react";

type Legend = { id: string; name: string; country: string | null; era: string | null; field: string | null; impact: string | null; active: boolean };
type Feature = { id: string; feature_date: string; headline: string; legends: { name: string } | null };

export default function NewsroomLegends() {
  const { user, loading } = useAuth();
  const [legends, setLegends] = useState<Legend[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [running, setRunning] = useState(false);
  const [form, setForm] = useState({ name: "", country: "", era: "", field: "", short_bio: "", impact: "" });

  const load = async () => {
    const [{ data: l }, { data: f }] = await Promise.all([
      supabase.from("legends").select("*").order("name"),
      supabase.from("legend_features").select("id, feature_date, headline, legends(name)").order("feature_date", { ascending: false }).limit(20),
    ]);
    setLegends((l as Legend[]) || []);
    setFeatures((f as unknown as Feature[]) || []);
  };

  useEffect(() => { if (user) load(); }, [user]);
  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) return <Navigate to="/auth" replace />;

  const runDaily = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("daily-legend");
      if (error) throw error;
      if (data?.already) toast.message("Today's legend already exists");
      else toast.success("New legend tribute generated");
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setRunning(false); }
  };

  const addLegend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const { error } = await supabase.from("legends").insert(form);
    if (error) toast.error(error.message);
    else { toast.success("Legend added"); setForm({ name: "", country: "", era: "", field: "", short_bio: "", impact: "" }); await load(); }
  };

  const toggle = async (l: Legend) => {
    await supabase.from("legends").update({ active: !l.active }).eq("id", l.id);
    await load();
  };

  return (
    <div className="min-h-screen bg-background">
      <Masthead variant="newsroom" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <div>
            <div className="label-eyebrow text-primary mb-1 flex items-center gap-1"><Crown size={11} /> Newsroom · Our Legends</div>
            <h1 className="font-display text-3xl">Legends roster</h1>
            <p className="text-sm text-ink-light">Curated African entertainment icons. One legend is featured daily.</p>
          </div>
          <button onClick={runDaily} disabled={running} className="bg-primary text-primary-foreground px-4 py-2.5 rounded text-sm font-medium hover:bg-primary-mid transition flex items-center gap-2 disabled:opacity-50">
            <Sparkles size={14} /> {running ? "Generating…" : "Generate today's tribute"}
          </button>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-8">
          <section>
            <h2 className="label-eyebrow text-primary mb-3">Roster ({legends.length})</h2>
            <div className="space-y-2 mb-8">
              {legends.map((l) => (
                <div key={l.id} className={`bg-card border border-border rounded p-3 flex items-center gap-3 ${!l.active ? "opacity-50" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-base">{l.name} <span className="text-ink-light text-xs font-sans">· {l.country} · {l.era}</span></div>
                    <div className="text-xs text-ink-mid line-clamp-1">{l.field} — {l.impact}</div>
                  </div>
                  <button onClick={() => toggle(l)} className="text-xs px-2 py-1 rounded border border-border hover:bg-muted">
                    {l.active ? "Pause" : "Activate"}
                  </button>
                </div>
              ))}
            </div>

            <h2 className="label-eyebrow text-primary mb-3">Recent features</h2>
            <div className="space-y-1.5">
              {features.map((f) => (
                <div key={f.id} className="text-sm flex gap-3">
                  <span className="font-mono-amaica text-[11px] text-ink-light w-24">{f.feature_date}</span>
                  <span className="font-medium">{f.legends?.name}</span>
                  <span className="text-ink-mid line-clamp-1">— {f.headline}</span>
                </div>
              ))}
              {features.length === 0 && <p className="text-sm text-ink-light">No features yet.</p>}
            </div>
          </section>

          <aside>
            <form onSubmit={addLegend} className="bg-card border border-border rounded p-4 sticky top-24 space-y-2">
              <h3 className="font-display text-lg flex items-center gap-2"><Plus size={14} /> Add legend</h3>
              {(["name", "country", "era", "field"] as const).map((k) => (
                <input key={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={k} className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm" />
              ))}
              <textarea value={form.short_bio} onChange={(e) => setForm({ ...form, short_bio: e.target.value })} placeholder="Short bio" rows={2} className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm" />
              <textarea value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })} placeholder="Impact on people" rows={3} className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm" />
              <button type="submit" className="w-full bg-primary text-primary-foreground rounded py-2 text-sm font-medium hover:bg-primary-mid transition">Add to roster</button>
            </form>
          </aside>
        </div>
      </main>
    </div>
  );
}