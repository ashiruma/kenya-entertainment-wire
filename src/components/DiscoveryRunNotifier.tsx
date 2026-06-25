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
        return;
      }
      if (data.id !== lastSeenId.current) {
        lastSeenId.current = data.id;
        const errCount = Array.isArray(data.errors) ? data.errors.length : 0;
        const msg = `Accepted ${data.inserted_count} · rejected ${data.rejected_count} · dupes ${data.duplicate_count}${errCount ? ` · ${errCount} errors` : ""}`;
        if (data.status === "failed") toast.error("Discovery run failed", { description: msg });
        else if (data.status === "partial") toast.warning("Discovery finished with errors", { description: msg });
        else toast.success("Discovery run finished", { description: msg });
      }
    };

    tick();
    const t = setInterval(tick, 20000);
    return () => { cancelled = true; clearInterval(t); };
  }, [isEditor]);

  return null;
}