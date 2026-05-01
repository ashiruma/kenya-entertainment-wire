import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth";
import { Masthead } from "@/components/Masthead";
import { toast } from "sonner";

type UserRow = {
  user_id: string;
  display_name: string | null;
  roles: AppRole[];
};

const ROLES: AppRole[] = ["admin", "editor", "writer"];

export default function Admin() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) return navigate("/auth");
    if (!isAdmin) return navigate("/newsroom");
    void load();
  }, [user, isAdmin, loading]);

  const load = async () => {
    const { data: profiles } = await supabase.from("profiles").select("user_id, display_name");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const byUser = new Map<string, AppRole[]>();
    (roles || []).forEach((r) => {
      const arr = byUser.get(r.user_id) || [];
      arr.push(r.role as AppRole);
      byUser.set(r.user_id, arr);
    });
    setRows(
      (profiles || []).map((p) => ({
        user_id: p.user_id,
        display_name: p.display_name,
        roles: byUser.get(p.user_id) || [],
      }))
    );
  };

  const toggleRole = async (uid: string, role: AppRole, has: boolean) => {
    setBusy(true);
    try {
      if (has) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
        if (error) throw error;
        toast.success(`Removed ${role}`);
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
        if (error) throw error;
        toast.success(`Granted ${role}`);
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Masthead />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="label-eyebrow text-primary mb-2">Newsroom Admin</div>
        <h1 className="font-display text-3xl mb-1">Team & Roles</h1>
        <p className="text-sm text-ink-light mb-6">Promote writers to editors or admins. New signups are writers by default.</p>

        <div className="bg-card border border-border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Member</th>
                {ROLES.map((r) => (
                  <th key={r} className="px-4 py-2 font-medium capitalize text-center">{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.user_id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.display_name || "—"}</div>
                    <div className="text-[11px] text-ink-light font-mono">{u.user_id.slice(0, 8)}…</div>
                  </td>
                  {ROLES.map((r) => {
                    const has = u.roles.includes(r);
                    return (
                      <td key={r} className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={has}
                          disabled={busy}
                          onChange={() => toggleRole(u.user_id, r, has)}
                          className="h-4 w-4 cursor-pointer"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-light">No members yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}