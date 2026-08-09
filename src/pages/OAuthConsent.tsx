import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};

const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("No redirect returned by the authorization server.");
    }
    window.location.href = target;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground border-b-[3px] border-accent">
        <div className="px-6 h-14 flex items-center">
          <Link to="/" className="font-display text-xl font-bold tracking-tight">
            Amaica <span className="text-accent">MEDIA</span>
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-card border border-border rounded p-6 shadow-card">
          {error ? (
            <>
              <div className="label-eyebrow text-destructive mb-2">Authorization error</div>
              <p className="text-sm text-ink-mid">{error}</p>
            </>
          ) : !details ? (
            <p className="text-sm text-ink-light">Loading…</p>
          ) : (
            <>
              <div className="label-eyebrow text-primary mb-2">Connect an app</div>
              <h1 className="font-display text-2xl mb-2">
                Connect {details.client?.name ?? "an app"} to your account
              </h1>
              <p className="text-sm text-ink-mid mb-6">
                This lets {details.client?.name ?? "the client"} read Amaica Media newsroom data as you.
              </p>
              <div className="flex gap-3">
                <button
                  disabled={busy}
                  onClick={() => decide(true)}
                  className="flex-1 bg-primary text-primary-foreground rounded px-4 py-2.5 text-sm font-medium hover:bg-primary-mid disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  disabled={busy}
                  onClick={() => decide(false)}
                  className="flex-1 border border-border rounded px-4 py-2.5 text-sm hover:bg-muted disabled:opacity-50"
                >
                  Deny
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}