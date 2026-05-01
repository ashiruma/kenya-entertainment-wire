import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(8, "Min 8 characters").max(72),
});

export default function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/newsroom", { replace: true });
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/newsroom",
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account created. Check your email to confirm.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/newsroom");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/newsroom" });
    if (result.error) toast.error("Google sign-in failed");
  };

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
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="label-eyebrow text-primary mb-2">Newsroom Access</div>
            <h1 className="font-display text-3xl mb-2">{mode === "signin" ? "Sign in to write" : "Join the newsroom"}</h1>
            <p className="text-sm text-ink-light">Amaica Media · Western Kenya entertainment desk</p>
          </div>

          <div className="bg-card border border-border rounded p-6 shadow-card">
            <button
              onClick={google}
              className="w-full flex items-center justify-center gap-2 border border-border rounded px-4 py-2.5 text-sm hover:bg-muted transition-colors mb-4"
            >
              <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 border-t border-border"></div>
              <span className="text-[10px] uppercase tracking-widest text-ink-light">or email</span>
              <div className="flex-1 border-t border-border"></div>
            </div>

            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <div>
                  <label className="label-eyebrow block mb-1">Display name</label>
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full border border-input rounded px-3 py-2 text-sm bg-background" placeholder="Jane Wanjiku" />
                </div>
              )}
              <div>
                <label className="label-eyebrow block mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border border-input rounded px-3 py-2 text-sm bg-background" placeholder="you@example.com" />
              </div>
              <div>
                <label className="label-eyebrow block mb-1">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="w-full border border-input rounded px-3 py-2 text-sm bg-background" />
              </div>
              <button disabled={busy} type="submit" className="w-full bg-primary text-primary-foreground rounded px-4 py-2.5 text-sm font-medium hover:bg-primary-mid transition-colors disabled:opacity-50">
                {busy ? "..." : mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>

            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="w-full mt-4 text-[12px] text-ink-light hover:text-primary">
              {mode === "signin" ? "New writer? Create an account" : "Have an account? Sign in"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}