import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { LogOut, User as UserIcon } from "lucide-react";

export function Masthead({ variant = "newsroom" }: { variant?: "newsroom" | "public" }) {
  const { user, signOut, isAdmin, isEditor } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <header className="bg-primary text-primary-foreground border-b-[3px] border-accent sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 sm:px-6 h-14">
          <Link to="/" className="font-display text-xl font-bold tracking-tight">
            Amaica <span className="text-accent">MEDIA</span>
          </Link>

          {variant === "newsroom" ? (
            <nav className="hidden md:flex items-center gap-6 text-[13px]">
              <NavLink to="/newsroom" className={({ isActive }) => isActive ? "text-accent" : "text-primary-foreground/80 hover:text-primary-foreground"}>Discover</NavLink>
              <NavLink to="/newsroom/drafts" className={({ isActive }) => isActive ? "text-accent" : "text-primary-foreground/80 hover:text-primary-foreground"}>Drafts</NavLink>
              <NavLink to="/newsroom/published" className={({ isActive }) => isActive ? "text-accent" : "text-primary-foreground/80 hover:text-primary-foreground"}>Published</NavLink>
              <NavLink to="/newsroom/legends" className={({ isActive }) => isActive ? "text-accent" : "text-primary-foreground/80 hover:text-primary-foreground"}>Legends</NavLink>
              {isEditor && (
                <NavLink to="/newsroom/health" className={({ isActive }) => isActive ? "text-accent" : "text-primary-foreground/80 hover:text-primary-foreground"}>Health</NavLink>
              )}
              {isAdmin && (
                <NavLink to="/newsroom/admin" className={({ isActive }) => isActive ? "text-accent" : "text-primary-foreground/80 hover:text-primary-foreground"}>Admin</NavLink>
              )}
              <NavLink to="/" className="text-primary-foreground/80 hover:text-primary-foreground">View site →</NavLink>
            </nav>
          ) : (
            <nav className="hidden md:flex items-center gap-6 text-[13px]">
              <NavLink end to="/" className={({ isActive }) => isActive ? "text-accent" : "text-primary-foreground/80 hover:text-primary-foreground"}>Latest</NavLink>
              <NavLink to="/category/music" className="text-primary-foreground/80 hover:text-primary-foreground">Music</NavLink>
              <NavLink to="/category/events" className="text-primary-foreground/80 hover:text-primary-foreground">Events</NavLink>
              <NavLink to="/category/film" className="text-primary-foreground/80 hover:text-primary-foreground">Film & TV</NavLink>
              <NavLink to="/category/celebrity" className="text-primary-foreground/80 hover:text-primary-foreground">Celebrity</NavLink>
            </nav>
          )}

          <div className="flex items-center gap-3">
            {user ? (
              <>
                {variant === "public" && (
                  <button onClick={() => navigate("/newsroom")} className="text-[12px] text-primary-foreground/80 hover:text-accent">Newsroom</button>
                )}
                <button onClick={async () => { await signOut(); navigate("/"); }} className="text-primary-foreground/70 hover:text-primary-foreground" aria-label="Sign out">
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <Link to="/auth" className="flex items-center gap-1.5 text-[12px] text-primary-foreground/80 hover:text-accent">
                <UserIcon size={14} /> Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="bg-destructive overflow-hidden h-[30px] flex items-center">
        <div className="bg-foreground text-background text-[10px] font-medium tracking-[0.12em] uppercase px-3.5 h-full flex items-center flex-shrink-0">
          {variant === "newsroom" ? "Newsroom" : "Live"}
        </div>
        <div className="flex animate-ticker whitespace-nowrap">
          {[0, 1].map((i) => (
            <span key={i} className="text-destructive-foreground text-[12px] px-8 tracking-wide">
              Western Kenya Entertainment &bull; Music &bull; Film &bull; Events &bull; Culture &nbsp;&nbsp;&bull;&nbsp;&nbsp; Lead with the fact. Attribute everything. One idea per sentence. &nbsp;&nbsp;&bull;&nbsp;&nbsp; Amaica Media — Newsroom of Western Kenya &nbsp;&nbsp;&bull;&nbsp;&nbsp;
            </span>
          ))}
        </div>
      </div>
    </>
  );
}