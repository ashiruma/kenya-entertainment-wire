import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Masthead } from "@/components/Masthead";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Ban, Trash2, Plus } from "lucide-react";

type Failure = {
  id: string;
  source_url: string;
  domain: string;
  last_status_code: number | null;
  last_error: string | null;
  fail_count: number;
  last_failed_at: string | null;
  last_success_at: string | null;
  blocked: boolean;
};

type BlockedDomain = { id: string; domain: string; reason: string | null; created_at: string };

export default function ScrapeHealth() {
  const { user, isEditor, loading } = useAuth();
  const navigate = useNavigate();
  const [failures, setFailures] = useState<Failure[]>([]);
  const [blocklist, setBlocklist] = useState<BlockedDomain[]>([]);
  const [newDomain, setNewDomain] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) return navigate("/auth", { replace: true });
    if (!isEditor) return navigate("/newsroom", { replace: true });
    void load();
  }, [user, isEditor, loading, navigate]);

  if (loading || !user || !isEditor) {
    return (
      <div className="min-h-screen bg-background">
        <Masthead />
        <main className="max-w-6xl mx-auto px-4 py-16 text-center text-sm text-ink-light">Verifying access…</main>
      </div>
    );
  }

  async function load() {
    const [f, b] = await Promise.all([
      supabase.from("scrape_failures").select("*").order("last_failed_at", { ascending: false, nullsFirst: false }).limit(200),
      supabase.from("scrape_blocklist").select("*").order("created_at", { ascending: false }),
    ]);
    setFailures((f.data as Failure[]) || []);
    setBlocklist((b.data as BlockedDomain[]) || []);
  }

  async function addBlock() {
    const d = newDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!d) return;
    const { error } = await supabase.from("scrape_blocklist").insert({ domain: d, reason: "Manually added" });
    if (error) toast.error(error.message); else { toast.success(`Blocked ${d}`); setNewDomain(""); load(); }
  }

  async function removeBlock(id: string) {
    const { error } = await supabase.from("scrape_blocklist").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removed"); load(); }
  }

  const failed = failures.filter((f) => !f.last_success_at || (f.last_failed_at && new Date(f.last_failed_at) > new Date(f.last_success_at || 0)));
  const succeeded = failures.filter((f) => f.last_success_at && (!f.last_failed_at || new Date(f.last_success_at) >= new Date(f.last_failed_at || 0)));

  return (
    <div className="min-h-screen bg-background">
      <Masthead />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        <div>
          <div className="label-eyebrow text-primary mb-2">Newsroom · Health</div>
          <h1 className="font-display text-3xl mb-1">Scrape failures & sources</h1>
          <p className="text-sm text-ink-light">Monitor which sources Firecrawl can and can't reach. Add domains to the blocklist to skip them.</p>
        </div>

        <section>
          <div className="flex items-baseline gap-2 mb-3">
            <AlertTriangle size={16} className="text-destructive" />
            <h2 className="font-display text-xl">Recent failures ({failed.length})</h2>
          </div>
          <div className="bg-card border border-border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Source URL</th>
                  <th className="px-3 py-2 font-medium">Domain</th>
                  <th className="px-3 py-2 font-medium text-center">Status</th>
                  <th className="px-3 py-2 font-medium">Error</th>
                  <th className="px-3 py-2 font-medium text-center">Fails</th>
                  <th className="px-3 py-2 font-medium">Last failed</th>
                  <th className="px-3 py-2 font-medium">Last success</th>
                </tr>
              </thead>
              <tbody>
                {failed.map((f) => (
                  <tr key={f.id} className="border-t border-border">
                    <td className="px-3 py-2 max-w-[260px] truncate"><a href={f.source_url} target="_blank" rel="noreferrer" className="hover:text-primary">{f.source_url}</a></td>
                    <td className="px-3 py-2 font-mono">{f.domain}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono ${f.last_status_code === 403 ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>
                        {f.last_status_code ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-ink-mid max-w-[200px] truncate">{f.last_error || "—"}</td>
                    <td className="px-3 py-2 text-center">{f.fail_count}</td>
                    <td className="px-3 py-2 text-ink-light">{f.last_failed_at ? new Date(f.last_failed_at).toLocaleString() : "—"}</td>
                    <td className="px-3 py-2 text-ink-light">{f.last_success_at ? new Date(f.last_success_at).toLocaleString() : "Never"}</td>
                  </tr>
                ))}
                {failed.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-ink-light">No failures recorded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="flex items-baseline gap-2 mb-3">
            <CheckCircle2 size={16} className="text-primary" />
            <h2 className="font-display text-xl">Healthy sources ({succeeded.length})</h2>
          </div>
          <div className="bg-card border border-border rounded p-3 text-xs text-ink-mid grid sm:grid-cols-2 gap-1">
            {succeeded.slice(0, 30).map((s) => (
              <div key={s.id} className="flex justify-between gap-2">
                <span className="font-mono truncate">{s.domain}</span>
                <span className="text-ink-light flex-shrink-0">{s.last_success_at && new Date(s.last_success_at).toLocaleDateString()}</span>
              </div>
            ))}
            {succeeded.length === 0 && <div className="text-ink-light">None yet.</div>}
          </div>
        </section>

        <section>
          <div className="flex items-baseline gap-2 mb-3">
            <Ban size={16} className="text-destructive" />
            <h2 className="font-display text-xl">Blocklist ({blocklist.length})</h2>
          </div>
          <div className="flex gap-2 mb-3">
            <input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="example.com"
              className="flex-1 px-3 py-2 text-sm border border-border rounded bg-background"
            />
            <button onClick={addBlock} className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium flex items-center gap-1.5">
              <Plus size={14} /> Block
            </button>
          </div>
          <div className="bg-card border border-border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Domain</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                  <th className="px-3 py-2 font-medium">Added</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {blocklist.map((b) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono">{b.domain}</td>
                    <td className="px-3 py-2 text-ink-mid">{b.reason || "—"}</td>
                    <td className="px-3 py-2 text-ink-light">{new Date(b.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => removeBlock(b.id)} className="text-destructive hover:opacity-70" aria-label="Remove">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
