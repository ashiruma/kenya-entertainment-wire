import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

/**
 * Polls the latest finished discovery_run and pops a toast for editors when a new
 * run finishes. Lightweight (one row, every 20s) and runs only while mounted.
 */
export function DiscoveryRunNotifier() {
  const { isEditor } = useAuth();
  const lastSeenId = useRef<string | null>(null);
  const initialized = useRef(false);
  // Track per-run alerts so we don't toast the same threshold breach repeatedly.
  const alertedRateLimit = useRef<Set<string>>(new Set());
  const alertedFailures = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isEditor) return;
    let cancelled = false;

    const tick = async () => {
      const { data } = await supabase
        .from("discovery_runs")
        .select("id, status, inserted_count, rejected_count, duplicate_count, errors, finished_at")
        .not("finished_at", "is", null)
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      if (!initialized.current) {
        lastSeenId.current = data.id;
        initialized.current = true;
      } else if (data.id !== lastSeenId.current) {
        lastSeenId.current = data.id;
        const errCount = Array.isArray(data.errors) ? data.errors.length : 0;
        const msg = `Accepted ${data.inserted_count} · rejected ${data.rejected_count} · dupes ${data.duplicate_count}${errCount ? ` · ${errCount} errors` : ""}`;
        if (data.status === "failed") toast.error("Discovery run failed", { description: msg });
        else if (data.status === "partial") toast.warning("Discovery finished with errors", { description: msg });
        else toast.success("Discovery run finished", { description: msg });
      }

      // Threshold alerts: look at write_article_attempts for recent runs and
      // toast once per run when rate_limited >= 3 or final failures >= 2.
      const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: attempts } = await supabase
        .from("write_article_attempts")
        .select("run_id, idempotency_key, status, retry_after_ms")
        .gte("created_at", sinceIso)
        .not("run_id", "is", null)
        .limit(1000);
      if (cancelled || !attempts) return;

      const byRun = new Map<string, { rl: number; failedKeys: Set<string> }>();
      for (const a of attempts) {
        const rid = a.run_id as string;
        if (!byRun.has(rid)) byRun.set(rid, { rl: 0, failedKeys: new Set() });
        const bucket = byRun.get(rid)!;
        if (a.status === "rate_limited") bucket.rl += 1;
        // Final failure attempts have no retry_after_ms (no further retry was scheduled).
        if (a.status === "error" && a.retry_after_ms == null) bucket.failedKeys.add(a.idempotency_key as string);
      }
      for (const [rid, b] of byRun) {
        if (b.rl >= 3 && !alertedRateLimit.current.has(rid)) {
          alertedRateLimit.current.add(rid);
          toast.warning("AI gateway rate-limiting", {
            description: `Run ${rid.slice(0, 8)}… hit ${b.rl} rate-limited attempts. Consider pausing bulk drafts.`,
          });
        }
        if (b.failedKeys.size >= 2 && !alertedFailures.current.has(rid)) {
          alertedFailures.current.add(rid);
          toast.error("Multiple write-article failures", {
            description: `Run ${rid.slice(0, 8)}… has ${b.failedKeys.size} stories that failed to draft.`,
          });
        }
      }
    };

    tick();
    const t = setInterval(tick, 20000);
    return () => { cancelled = true; clearInterval(t); };
  }, [isEditor]);

  return null;
}