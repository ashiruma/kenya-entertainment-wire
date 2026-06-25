import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Masthead } from "@/components/Masthead";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { RefreshCw, Power, Plus, Trash2, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type Feed = {
  id: string; kind: "rss" | "query"; name: string; url: string | null; query: string | null;
  enabled: boolean; last_fetched_at: string | null; last_status: string | null; last_error: string | null;
  last_item_count: number; total_accepted: number; total_rejected: number; total_duplicates: number;
  priority: number; weight: number;
};
type Run = {
  id: string; started_at: string; finished_at: string | null; status: string; trigger: string;
  fetched_count: number; inserted_count: number; duplicate_count: number; rejected_count: number;
  errors: Array<{ name: string; error: string }>; feed_stats: Array<{ feed_id: string; name: string; fetched: number; accepted: number; rejected: number; duplicates: number }>;
};
type Settings = { enabled: boolean; interval_minutes: number };
type Story = { region: string | null; status: string; rejection_reason: string | null; feed_id: string | null };

export default function DiscoveryAdmin() {
  const { user, loading, isEditor } = useAuth();
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [settings, setSettings] = useState<Settings>({ enabled: false, interval_minutes: 60 });
  const [stories, setStories] = useState<Story[]>([]);
  const [busy, setBusy] = useState(false);
  const [newKind, setNewKind] = useState<"rss" | "query">("rss");
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const load = async () => {
    const [f, r, s, st] = await Promise.all([
      supabase.from("discovery_feeds").select("*").order("kind").order("name"),
      supabase.from("discovery_runs").select("*").order("started_at", { ascending: false }).limit(20),
      supabase.from("discovery_settings").select("*").maybeSingle(),
      supabase.from("discovered_stories").select("region,status,rejection_reason,feed_id").limit(2000),
    ]);
    if (f.data) setFeeds(f.data as Feed[]);
    if (r.data) setRuns(r.data as unknown as Run[]);
    if (s.data) setSettings({ enabled: s.data.enabled, interval_minutes: s.data.interval_minutes });
    if (st.data) setStories(st.data as Story[]);
  };
  useEffect(() => { if (user && isEditor) load(); }, [user, isEditor]);

  // Live-poll the active run while one is in progress
  useEffect(() => {
    if (!activeRunId) return;
    const t = setInterval(async () => {
      const { data } = await supabase.from("discovery_runs").select("*").eq("id", activeRunId).maybeSingle();
      if (data) {
        setRuns((prev) => {
          const others = prev.filter((r) => r.id !== data.id);
          return [data as unknown as Run, ...others].slice(0, 20);
        });
        if (data.finished_at) {
          setActiveRunId(null);
          toast.success(`Run finished — accepted ${data.inserted_count}, rejected ${data.rejected_count}, dupes ${data.duplicate_count}`);
          load();
        }
      }
    }, 2500);
    return () => clearInterval(t);
  }, [activeRunId]);

  const analytics = useMemo(() => {
    const byFeed = new Map<string, { accepted: number; used: number; rejected: number; skipped: number; total: number }>();
    const byRegion = { western_kenya: 0, national: 0 } as Record<string, number>;
    const byReason = new Map<string, number>();
    for (const s of stories) {
      if (s.region) byRegion[s.region] = (byRegion[s.region] || 0) + 1;
      if (s.feed_id) {
        const cur = byFeed.get(s.feed_id) || { accepted: 0, used: 0, rejected: 0, skipped: 0, total: 0 };
        cur.total++;
        if (s.status === "new") cur.accepted++;
        else if (s.status === "used") { cur.used++; cur.accepted++; }
        else if (s.status === "rejected") cur.rejected++;
        else if (s.status === "skipped") cur.skipped++;
        byFeed.set(s.feed_id, cur);
      }
      if (s.rejection_reason) byReason.set(s.rejection_reason, (byReason.get(s.rejection_reason) || 0) + 1);
    }
    return { byFeed, byRegion, byReason };
  }, [stories]);

  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isEditor) return <Navigate to="/newsroom" replace />;

  const saveSettings = async () => {
    setBusy(true);
    const { error } = await supabase.from("discovery_settings").update({
      enabled: settings.enabled, interval_minutes: settings.interval_minutes, updated_at: new Date().toISOString(),
    }).eq("id", true);
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Scheduler updated");
  };

  const toggleFeed = async (f: Feed) => {
    const { error } = await supabase.from("discovery_feeds").update({ enabled: !f.enabled }).eq("id", f.id);
    if (error) toast.error(error.message); else { setFeeds(feeds.map((x) => x.id === f.id ? { ...x, enabled: !f.enabled } : x)); }
  };

  const deleteFeed = async (f: Feed) => {
    if (!confirm(`Delete ${f.name}?`)) return;
    const { error } = await supabase.from("discovery_feeds").delete().eq("id", f.id);
    if (error) toast.error(error.message); else setFeeds(feeds.filter((x) => x.id !== f.id));
  };

  const addFeed = async () => {
    if (!newName.trim() || !newValue.trim()) { toast.error("Name and value required"); return; }
    const row = { kind: newKind, name: newName.trim(), enabled: true,
      url: newKind === "rss" ? newValue.trim() : null,
      query: newKind === "query" ? newValue.trim() : null };
    const { data, error } = await supabase.from("discovery_feeds").insert(row).select().single();
    if (error) toast.error(error.message);
    else { setFeeds([...(feeds || []), data as Feed]); setNewName(""); setNewValue(""); toast.success("Added"); }
  };

  const runNow = async () => {
    setBusy(true);
    try {
      toast.message("Discovery starting…");
      // fire-and-poll so the UI shows live status
      supabase.functions.invoke("discover-news", { body: { trigger: "manual" } }).then(({ data, error }) => {
        if (error) toast.error(error.message);
        else if (data?.skipped) toast.message(`Skipped: ${data.reason}`);
      });
      // Wait briefly for the run row to be created, then start polling
      setTimeout(async () => {
        const { data } = await supabase.from("discovery_runs").select("id").is("finished_at", null).order("started_at", { ascending: false }).limit(1);
        if (data && data[0]) setActiveRunId(data[0].id);
        await load();
      }, 1500);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Run failed"); }
    finally { setBusy(false); }
  };

  const updateFeedField = async (f: Feed, field: "priority" | "weight", value: number) => {
    const { error } = await supabase.from("discovery_feeds").update({ [field]: value }).eq("id", f.id);
    if (error) toast.error(error.message);
    else setFeeds(feeds.map((x) => x.id === f.id ? { ...x, [field]: value } : x));
  };

  const StatusIcon = ({ s }: { s: string | null }) => {
    if (s === "ok") return <CheckCircle2 size={14} className="text-green-600" />;
    if (s === "error") return <XCircle size={14} className="text-destructive" />;
    return <Clock size={14} className="text-ink-light" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <Masthead variant="newsroom" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="label-eyebrow text-primary mb-1">Newsroom · Discovery</div>
            <h1 className="font-display text-3xl">Feeds, scheduler & analytics</h1>
          </div>
          <button onClick={runNow} disabled={busy} className="bg-primary text-primary-foreground px-4 py-2.5 rounded text-sm font-medium hover:bg-primary-mid transition flex items-center gap-2 disabled:opacity-50">
            <RefreshCw size={14} className={busy ? "animate-spin" : ""} /> Run discovery now
          </button>
        </div>

        {/* Scheduler */}
        <section className="bg-card border border-border rounded p-5">
          <h2 className="font-display text-lg mb-3 flex items-center gap-2"><Power size={16} /> Scheduler</h2>
          <div className="flex items-center gap-4 flex-wrap text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
              Auto-run discovery
            </label>
            <label className="flex items-center gap-2">
              Interval (minutes):
              <input type="number" min={5} max={1440} value={settings.interval_minutes}
                onChange={(e) => setSettings({ ...settings, interval_minutes: parseInt(e.target.value || "60") })}
                className="border border-border rounded px-2 py-1 w-24" />
            </label>
            <button onClick={saveSettings} disabled={busy} className="bg-foreground text-background px-3 py-1.5 rounded text-xs disabled:opacity-50">Save</button>
            <span className="text-xs text-ink-light">Cron ticks every 5 min; overlapping runs are skipped automatically.</span>
          </div>
        </section>

        {/* Analytics */}
        <section className="bg-card border border-border rounded p-5">
          <h2 className="font-display text-lg mb-3">Analytics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="border border-border rounded p-3">
              <div className="label-eyebrow text-primary mb-2">Region coverage</div>
              <div className="text-sm">Western Kenya: <strong>{analytics.byRegion.western_kenya || 0}</strong></div>
              <div className="text-sm">National / other: <strong>{analytics.byRegion.national || 0}</strong></div>
            </div>
            <div className="border border-border rounded p-3 md:col-span-2">
              <div className="label-eyebrow text-primary mb-2">Rejection reasons</div>
              {analytics.byReason.size === 0 ? <div className="text-sm text-ink-light">None yet.</div> : (
                <ul className="text-sm space-y-1">
                  {[...analytics.byReason.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                    <li key={k} className="flex justify-between"><span>{k.replace(/_/g, " ")}</span><strong>{v}</strong></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Feeds */}
        <section className="bg-card border border-border rounded p-5">
          <h2 className="font-display text-lg mb-3">Feeds & queries</h2>
          <div className="flex gap-2 mb-4 flex-wrap items-end">
            <select value={newKind} onChange={(e) => setNewKind(e.target.value as "rss" | "query")} className="border border-border rounded px-2 py-1.5 text-sm">
              <option value="rss">RSS feed</option>
              <option value="query">Search query</option>
            </select>
            <input placeholder="Display name" value={newName} onChange={(e) => setNewName(e.target.value)} className="border border-border rounded px-2 py-1.5 text-sm flex-1 min-w-[180px]" />
            <input placeholder={newKind === "rss" ? "https://example.com/feed.xml" : "Search query terms"} value={newValue} onChange={(e) => setNewValue(e.target.value)} className="border border-border rounded px-2 py-1.5 text-sm flex-[2] min-w-[240px]" />
            <button onClick={addFeed} className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-xs flex items-center gap-1"><Plus size={12} /> Add</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-ink-light border-b border-border">
                <tr><th className="py-2">On</th><th>Kind</th><th>Name</th><th>URL / Query</th><th title="Higher runs first">Pri</th><th title="Bias for ordering">Wt</th><th>Last fetched</th><th>Status</th><th>Items</th><th>Accepted</th><th>Rejected</th><th>Dupes</th><th></th></tr>
              </thead>
              <tbody>
                {feeds.map((f) => {
                  const a = analytics.byFeed.get(f.id);
                  return (
                    <tr key={f.id} className="border-b border-border/60">
                      <td className="py-2"><input type="checkbox" checked={f.enabled} onChange={() => toggleFeed(f)} /></td>
                      <td className="text-xs uppercase">{f.kind}</td>
                      <td className="font-medium">{f.name}</td>
                      <td className="text-xs text-ink-mid max-w-[260px] truncate" title={f.url || f.query || ""}>{f.url || f.query}</td>
                      <td><input type="number" value={f.priority ?? 0} onChange={(e) => updateFeedField(f, "priority", parseInt(e.target.value || "0"))} className="w-14 border border-border rounded px-1 py-0.5 text-xs" /></td>
                      <td><input type="number" step="0.1" value={f.weight ?? 1} onChange={(e) => updateFeedField(f, "weight", parseFloat(e.target.value || "1"))} className="w-16 border border-border rounded px-1 py-0.5 text-xs" /></td>
                      <td className="text-xs">{f.last_fetched_at ? new Date(f.last_fetched_at).toLocaleString() : "—"}</td>
                      <td><div className="flex items-center gap-1"><StatusIcon s={f.last_status} />{f.last_error && <span title={f.last_error}><AlertTriangle size={12} className="text-amber-600" /></span>}</div></td>
                      <td className="text-xs">{f.last_item_count}</td>
                      <td className="text-xs">{a?.accepted ?? 0}</td>
                      <td className="text-xs">{a?.rejected ?? 0}</td>
                      <td className="text-xs">{a?.skipped ?? 0}</td>
                      <td><button onClick={() => deleteFeed(f)} className="text-ink-light hover:text-destructive"><Trash2 size={14} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {activeRunId && (
            <div className="mt-3 text-xs text-primary flex items-center gap-2">
              <RefreshCw size={12} className="animate-spin" /> Live run in progress — table updates every few seconds.
            </div>
          )}
        </section>

        {/* Runs */}
        <section className="bg-card border border-border rounded p-5">
          <h2 className="font-display text-lg mb-3">Recent runs</h2>
          <div className="space-y-2">
            {runs.length === 0 && <div className="text-sm text-ink-light">No runs yet.</div>}
            {runs.map((r) => (
              <details key={r.id} className="border border-border rounded p-3">
                <summary className="cursor-pointer flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 text-sm">
                    <span className={`text-xs px-2 py-0.5 rounded ${r.status === "success" ? "bg-green-100 text-green-800" : r.status === "partial" ? "bg-amber-100 text-amber-800" : r.status === "failed" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}`}>{r.status}</span>
                    <span className="text-xs text-ink-light">{new Date(r.started_at).toLocaleString()} · {r.trigger}</span>
                  </div>
                  <div className="text-xs text-ink-mid">fetched {r.fetched_count} · inserted {r.inserted_count} · dupes {r.duplicate_count} · rejected {r.rejected_count} · errors {r.errors?.length ?? 0}</div>
                </summary>
                {r.errors?.length > 0 && (
                  <div className="mt-3 text-xs">
                    <div className="font-medium mb-1">Errors</div>
                    <ul className="space-y-1 text-destructive">{r.errors.map((e, i) => <li key={i}>· {e.name}: {e.error}</li>)}</ul>
                  </div>
                )}
                {r.feed_stats?.length > 0 && (
                  <div className="mt-3 text-xs text-ink-mid max-h-40 overflow-auto">
                    {r.feed_stats.map((s, i) => (
                      <div key={i} className="flex justify-between border-b border-border/40 py-1">
                        <span>{s.name}</span><span>{s.accepted}/{s.fetched} accepted · {s.duplicates} dupes · {s.rejected} rejected</span>
                      </div>
                    ))}
                  </div>
                )}
              </details>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}