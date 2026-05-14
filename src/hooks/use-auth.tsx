import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "super_admin" | "company_admin" | "staff";

interface CompanyMembership {
  company_id: string;
  role: Role;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  roles: Role[];
  company: CompanyMembership | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isCompanyAdmin: boolean;
  isStaff: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [company, setCompany] = useState<CompanyMembership | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) setTimeout(() => loadAccess(s.user.id), 0);
      else { setRoles([]); setCompany(null); }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadAccess(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadAccess(uid: string) {
    const [r, c] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("company_users").select("company_id, role").eq("user_id", uid).eq("is_active", true).maybeSingle(),
    ]);
    setRoles((r.data ?? []).map((x) => x.role as Role));
    setCompany(c.data ? { company_id: c.data.company_id, role: c.data.role as Role } : null);
  }

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    roles,
    company,
    loading,
    isSuperAdmin: roles.includes("super_admin"),
    isCompanyAdmin: company?.role === "company_admin",
    isStaff: company?.role === "staff",
    signOut: async () => { await supabase.auth.signOut(); },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
