import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, ShieldCheck } from "lucide-react";

export function SiteHeader() {
  const { user, isSuperAdmin, isCompanyAdmin, isStaff, signOut } = useAuth();
  const navigate = useNavigate();

  const dashboardPath = isSuperAdmin ? "/admin" : (isCompanyAdmin || isStaff) ? "/company" : "/admin";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 glass-strong">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2.5 font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand shadow-glow">
            <ShieldCheck className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg tracking-tight">Asad<span className="text-gradient-brand">2flow</span></span>
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: dashboardPath })}>
                Dashboard
              </Button>
              <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button size="sm" className="bg-gradient-brand text-primary-foreground hover:opacity-90" onClick={() => navigate({ to: "/login" })}>
              Admin Login
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
