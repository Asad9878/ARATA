import { Link, useNavigate } from "@tanstack/react-router";
import { CircleGauge, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-gradient-accent shadow-glow">
            <CircleGauge className="h-5 w-5 text-accent-foreground" />
          </span>
          <span className="text-base">RimGuard</span>
          <span className="hidden text-xs uppercase tracking-widest text-muted-foreground sm:inline">
            Warranty
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              {isAdmin && (
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/admin">
                    <ShieldCheck className="mr-1 h-4 w-4" /> Admin
                  </Link>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
              >
                <LogOut className="mr-1 h-4 w-4" /> Sign out
              </Button>
            </>
          ) : (
            <Button size="sm" asChild>
              <Link to="/login">Admin sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
