import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Building2, Package, Users, BarChart3, ShieldCheck, Plus, Loader2,
  TrendingUp, ScanQrCode, Wrench, AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminPage });

type Pkg = { id: string; name: string; price: number; duration_months: number; max_products: number; max_dealers: number; max_qr_codes: number };
type Company = { id: string; name: string; slug: string; status: string; package_id: string | null; subscription_expires_at: string | null; contact_email: string | null; created_at: string };
type Stats = { companies: number; activeSubs: number; expired: number; qr: number; activations: number; claims: number };

function AdminPage() {
  const { isSuperAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("dashboard");
  const [stats, setStats] = useState<Stats>({ companies: 0, activeSubs: 0, expired: 0, qr: 0, activations: 0, claims: 0 });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [packages, setPackages] = useState<Pkg[]>([]);

  useEffect(() => {
    if (!loading && !isSuperAdmin) navigate({ to: "/" });
  }, [isSuperAdmin, loading, navigate]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    void refresh();
  }, [isSuperAdmin]);

  async function refresh() {
    const [c, p, inv, act, cl] = await Promise.all([
      supabase.from("companies").select("*").order("created_at", { ascending: false }),
      supabase.from("packages").select("*").order("price"),
      supabase.from("inventory").select("id", { count: "exact", head: true }),
      supabase.from("activations").select("id", { count: "exact", head: true }),
      supabase.from("claims").select("id", { count: "exact", head: true }),
    ]);
    setCompanies((c.data ?? []) as Company[]);
    setPackages((p.data ?? []) as Pkg[]);
    const list = (c.data ?? []) as Company[];
    setStats({
      companies: list.length,
      activeSubs: list.filter((x) => x.status === "active").length,
      expired: list.filter((x) => x.status === "expired").length,
      qr: inv.count ?? 0,
      activations: act.count ?? 0,
      claims: cl.count ?? 0,
    });
  }

  if (loading || !isSuperAdmin) {
    return <div className="min-h-screen"><SiteHeader /><div className="flex justify-center py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div></div>;
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Super Admin</p>
            <h1 className="text-3xl font-semibold mt-1">Platform Console</h1>
          </div>
          <Badge className="bg-gradient-brand text-primary-foreground border-0">SaaS</Badge>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="glass mb-6">
            <TabsTrigger value="dashboard"><BarChart3 className="h-4 w-4 mr-1.5" />Dashboard</TabsTrigger>
            <TabsTrigger value="companies"><Building2 className="h-4 w-4 mr-1.5" />Companies</TabsTrigger>
            <TabsTrigger value="packages"><Package className="h-4 w-4 mr-1.5" />Packages</TabsTrigger>
            <TabsTrigger value="users"><Users className="h-4 w-4 mr-1.5" />Users</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard icon={Building2} label="Total Companies" value={stats.companies} hue="from-violet-500 to-fuchsia-500" />
              <StatCard icon={ShieldCheck} label="Active Subscriptions" value={stats.activeSubs} hue="from-emerald-500 to-teal-500" />
              <StatCard icon={AlertTriangle} label="Expired Companies" value={stats.expired} hue="from-amber-500 to-orange-500" />
              <StatCard icon={ScanQrCode} label="QR Generated" value={stats.qr} hue="from-cyan-500 to-blue-500" />
              <StatCard icon={TrendingUp} label="Warranty Activations" value={stats.activations} hue="from-pink-500 to-rose-500" />
              <StatCard icon={Wrench} label="Total Claims" value={stats.claims} hue="from-indigo-500 to-purple-500" />
            </div>
            <div className="rounded-2xl glass p-6 text-center text-sm text-muted-foreground">
              Detailed charts (monthly activations, revenue, claims) ship in the next phase.
            </div>
          </TabsContent>

          <TabsContent value="companies"><CompaniesTab companies={companies} packages={packages} onChange={refresh} /></TabsContent>
          <TabsContent value="packages"><PackagesTab packages={packages} onChange={refresh} /></TabsContent>
          <TabsContent value="users"><UsersTab companies={companies} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hue }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; hue: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl glass p-5">
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${hue}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value.toLocaleString()}</p>
    </motion.div>
  );
}

function CompaniesTab({ companies, packages, onChange }: { companies: Company[]; packages: Pkg[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", contact_email: "", package_id: "", expires: "" });
  const [submitting, setSubmitting] = useState(false);

  async function create() {
    if (!form.name || !form.slug) { toast.error("Name and slug required"); return; }
    setSubmitting(true);
    const pkg = packages.find((p) => p.id === form.package_id);
    const expires = form.expires || (pkg ? new Date(Date.now() + pkg.duration_months * 30 * 24 * 3600 * 1000).toISOString() : null);
    const { error } = await supabase.from("companies").insert({
      name: form.name, slug: form.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      contact_email: form.contact_email || null,
      package_id: form.package_id || null,
      subscription_expires_at: expires,
      status: "active",
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Company created");
    setOpen(false); setForm({ name: "", slug: "", contact_email: "", package_id: "", expires: "" });
    onChange();
  }

  async function setStatus(id: string, status: "active" | "suspended" | "expired") {
    const { error } = await supabase.from("companies").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); onChange(); }
  }

  return (
    <div className="rounded-2xl glass p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold">Companies</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="bg-gradient-brand text-primary-foreground"><Plus className="h-4 w-4 mr-1" />Add Company</Button></DialogTrigger>
          <DialogContent className="glass-strong">
            <DialogHeader><DialogTitle>New Company</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-") })} className="glass" /></div>
              <div><Label className="text-xs">Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="glass font-mono" /></div>
              <div><Label className="text-xs">Contact email</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className="glass" /></div>
              <div>
                <Label className="text-xs">Package</Label>
                <Select value={form.package_id} onValueChange={(v) => setForm({ ...form, package_id: v })}>
                  <SelectTrigger className="glass"><SelectValue placeholder="Select package" /></SelectTrigger>
                  <SelectContent>{packages.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — ${p.price}/{p.duration_months}mo</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Expires (optional)</Label><Input type="date" value={form.expires} onChange={(e) => setForm({ ...form, expires: e.target.value })} className="glass" /></div>
            </div>
            <DialogFooter><Button onClick={create} disabled={submitting} className="bg-gradient-brand text-primary-foreground">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border/40">
              <th className="text-left py-2 px-2">Company</th>
              <th className="text-left py-2 px-2">Package</th>
              <th className="text-left py-2 px-2">Status</th>
              <th className="text-left py-2 px-2">Expires</th>
              <th className="py-2 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => {
              const pkg = packages.find((p) => p.id === c.package_id);
              return (
                <tr key={c.id} className="border-b border-border/20 hover:bg-white/[0.02]">
                  <td className="py-3 px-2">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{c.slug}</div>
                  </td>
                  <td className="px-2">{pkg?.name ?? "—"}</td>
                  <td className="px-2"><StatusBadge status={c.status} /></td>
                  <td className="px-2 text-muted-foreground">{c.subscription_expires_at ? new Date(c.subscription_expires_at).toLocaleDateString() : "—"}</td>
                  <td className="px-2 text-right">
                    {c.status !== "suspended" ? (
                      <Button size="sm" variant="ghost" onClick={() => setStatus(c.id, "suspended")}>Suspend</Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setStatus(c.id, "active")}>Reactivate</Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {companies.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">No companies yet — add your first tenant.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-success/15 text-success border-success/30",
    suspended: "bg-destructive/15 text-destructive border-destructive/30",
    expired: "bg-warning/15 text-warning border-warning/30",
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${map[status] ?? ""}`}>{status}</span>;
}

function PackagesTab({ packages, onChange }: { packages: Pkg[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", price: 0, duration_months: 12, max_products: 100, max_dealers: 50, max_qr_codes: 10000 });

  async function create() {
    if (!form.name) { toast.error("Name required"); return; }
    const { error } = await supabase.from("packages").insert(form);
    if (error) { toast.error(error.message); return; }
    toast.success("Package created"); setOpen(false); onChange();
  }

  return (
    <div className="rounded-2xl glass p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold">Packages</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="bg-gradient-brand text-primary-foreground"><Plus className="h-4 w-4 mr-1" />Add Package</Button></DialogTrigger>
          <DialogContent className="glass-strong">
            <DialogHeader><DialogTitle>New Package</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="glass" /></div>
              <div><Label className="text-xs">Price (USD)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} className="glass" /></div>
              <div><Label className="text-xs">Duration (months)</Label><Input type="number" value={form.duration_months} onChange={(e) => setForm({ ...form, duration_months: +e.target.value })} className="glass" /></div>
              <div><Label className="text-xs">Max products</Label><Input type="number" value={form.max_products} onChange={(e) => setForm({ ...form, max_products: +e.target.value })} className="glass" /></div>
              <div><Label className="text-xs">Max dealers</Label><Input type="number" value={form.max_dealers} onChange={(e) => setForm({ ...form, max_dealers: +e.target.value })} className="glass" /></div>
              <div className="col-span-2"><Label className="text-xs">Max QR codes</Label><Input type="number" value={form.max_qr_codes} onChange={(e) => setForm({ ...form, max_qr_codes: +e.target.value })} className="glass" /></div>
            </div>
            <DialogFooter><Button onClick={create} className="bg-gradient-brand text-primary-foreground">Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {packages.map((p) => (
          <div key={p.id} className="rounded-xl glass p-5">
            <h3 className="text-lg font-semibold">{p.name}</h3>
            <p className="mt-1 text-3xl font-semibold">${p.price}<span className="text-sm font-normal text-muted-foreground">/{p.duration_months}mo</span></p>
            <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              <li>{p.max_products.toLocaleString()} products</li>
              <li>{p.max_dealers.toLocaleString()} dealers</li>
              <li>{p.max_qr_codes.toLocaleString()} QR codes</li>
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersTab({ companies }: { companies: Company[] }) {
  const [users, setUsers] = useState<Array<{ id: string; user_id: string; company_id: string; role: string; full_name: string | null; is_active: boolean }>>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", company_id: "", role: "company_admin" as "company_admin" | "staff" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { void load(); }, []);
  async function load() {
    const { data } = await supabase.from("company_users").select("id, user_id, company_id, role, full_name, is_active").order("created_at", { ascending: false });
    setUsers((data ?? []) as typeof users);
  }

  const companyMap = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c.name])), [companies]);

  async function create() {
    if (!form.email || !form.password || !form.company_id) { toast.error("Fill all fields"); return; }
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email, password: form.password,
      options: { data: { full_name: form.full_name }, emailRedirectTo: window.location.origin },
    });
    if (error || !data.user) { setSubmitting(false); toast.error(error?.message ?? "Failed"); return; }
    const { error: e2 } = await supabase.from("company_users").insert({
      user_id: data.user.id, company_id: form.company_id, role: form.role, full_name: form.full_name || null,
    });
    setSubmitting(false);
    if (e2) { toast.error(e2.message); return; }
    toast.success("User invited"); setOpen(false); setForm({ email: "", password: "", full_name: "", company_id: "", role: "company_admin" });
    void load();
  }

  return (
    <div className="rounded-2xl glass p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold">Company Users</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="bg-gradient-brand text-primary-foreground"><Plus className="h-4 w-4 mr-1" />Invite User</Button></DialogTrigger>
          <DialogContent className="glass-strong">
            <DialogHeader><DialogTitle>Invite Company User</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="glass" /></div>
              <div><Label className="text-xs">Temporary password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="glass" /></div>
              <div><Label className="text-xs">Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="glass" /></div>
              <div>
                <Label className="text-xs">Company</Label>
                <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                  <SelectTrigger className="glass"><SelectValue placeholder="Select company" /></SelectTrigger>
                  <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "company_admin" | "staff" })}>
                  <SelectTrigger className="glass"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company_admin">Company Admin</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={create} disabled={submitting} className="bg-gradient-brand text-primary-foreground">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Invite"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border/40">
              <th className="text-left py-2 px-2">Name</th>
              <th className="text-left py-2 px-2">Company</th>
              <th className="text-left py-2 px-2">Role</th>
              <th className="text-left py-2 px-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border/20">
                <td className="py-3 px-2">{u.full_name ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="px-2">{companyMap[u.company_id] ?? "—"}</td>
                <td className="px-2"><Badge variant="secondary">{u.role}</Badge></td>
                <td className="px-2">{u.is_active ? <span className="text-success text-xs">Active</span> : <span className="text-muted-foreground text-xs">Inactive</span>}</td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">No company users yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
