import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_MIN_WORD_COUNT = 1600;

export function useMinWordCount(): { minWordCount: number; loading: boolean; refresh: () => Promise<void> } {
  const [minWordCount, setMinWordCount] = useState<number>(DEFAULT_MIN_WORD_COUNT);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const { data } = await supabase
      .from("newsroom_settings")
      .select("value")
      .eq("key", "min_word_count")
      .maybeSingle();
    const raw = (data?.value as unknown);
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n) && n > 0) setMinWordCount(n);
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, []);
  return { minWordCount, loading, refresh };
}