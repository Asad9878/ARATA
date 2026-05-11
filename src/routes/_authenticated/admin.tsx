import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ShieldAlert, Plus } from "lucide-react";

type Product = { id: string; name: string; sku: string; warranty_months: number; description: string | null };
type Rim = {
  id: string; serial_number: string; status: string; expiry_date: string | null;
  owner_name: string | null; dealer_id: string | null;
  product: { name: string } | null;
};
type Claim = {
  id: string; customer_name: string; customer_email: string; issue_description: string;
  status: "pending" | "approved" | "rejected"; created_at: string; admin_notes: string | null;
  rim: { serial_number: string; product: { name: string } | null } | null;
};

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { isAdmin, loading } = useAuth();

  if (loading) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-warning" />
          <h1 className="mt-4 text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account is a dealer account. To grant admin access, an existing admin must add the role from the
            backend dashboard (table <span className="font-mono">user_roles</span>).
          </p>
        </div>
      </div>
    );
  }

  return <AdminContent />;
}

function AdminContent() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Admin console</p>
          <h1 className="mt-1 text-3xl font-semibold">Operations</h1>
        </div>

        <Tabs defaultValue="claims">
          <TabsList>
            <TabsTrigger value="claims">Claims</TabsTrigger>
            <TabsTrigger value="rims">All rims</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
          </TabsList>
          <TabsContent value="claims" className="mt-6"><ClaimsPanel /></TabsContent>
          <TabsContent value="rims" className="mt-6"><RimsPanel /></TabsContent>
          <TabsContent value="products" className="mt-6"><ProductsPanel /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ClaimsPanel() {
  const [claims, setClaims] = useState<Claim[]>([]);

  async function load() {
    const { data } = await supabase
      .from("claims")
      .select("id,customer_name,customer_email,issue_description,status,created_at,admin_notes, rim:rims(serial_number, product:products(name))")
      .order("created_at", { ascending: false });
    setClaims((data ?? []) as never);
  }
  useEffect(() => { load(); }, []);

  async function decide(id: string, status: "approved" | "rejected", rimId?: string) {
    const { error } = await supabase
      .from("claims")
      .update({ status, resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    if (status === "approved" && rimId) {
      await supabase.from("rims").update({ status: "claimed" }).eq("id", rimId);
    }
    toast.success(`Claim ${status}`);
    load();
  }

  if (claims.length === 0) return <Card className="border-border/60 bg-card/60 p-10 text-center text-muted-foreground">No claims yet.</Card>;

  return (
    <div className="space-y-3">
      {claims.map((c) => (
        <Card key={c.id} className="border-border/60 bg-card/80 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{c.customer_name}</h3>
                <ClaimBadge status={c.status} />
              </div>
              <p className="text-sm text-muted-foreground">{c.customer_email} · {new Date(c.created_at).toLocaleDateString()}</p>
              <p className="mt-1 text-sm">
                <span className="font-mono text-xs">{c.rim?.serial_number}</span> · {c.rim?.product?.name}
              </p>
              <p className="mt-3 text-sm">{c.issue_description}</p>
            </div>
            {c.status === "pending" && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => decide(c.id, "rejected")}>Reject</Button>
                <Button size="sm" onClick={() => {
                  // we need rim id — fetch
                  supabase.from("claims").select("rim_id").eq("id", c.id).single().then(({ data }) => {
                    decide(c.id, "approved", data?.rim_id);
                  });
                }}>Approve</Button>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function ClaimBadge({ status }: { status: Claim["status"] }) {
  if (status === "approved") return <Badge className="bg-success/20 text-success hover:bg-success/20">Approved</Badge>;
  if (status === "rejected") return <Badge variant="outline" className="border-destructive/40 text-destructive">Rejected</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}

function RimsPanel() {
  const [rims, setRims] = useState<Rim[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    supabase
      .from("rims")
      .select("id,serial_number,status,expiry_date,owner_name,dealer_id, product:products(name)")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => setRims((data ?? []) as never));
  }, []);
  const filtered = rims.filter((r) => r.serial_number.toLowerCase().includes(q.toLowerCase()) || r.owner_name?.toLowerCase().includes(q.toLowerCase()));

  return (
    <Card className="border-border/60 bg-card/80 p-5">
      <Input placeholder="Search by serial or owner…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-sm" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
            <tr><th className="py-2">Serial</th><th>Model</th><th>Status</th><th>Owner</th><th>Expires</th></tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="py-3 font-mono text-xs">{r.serial_number}</td>
                <td>{r.product?.name ?? "—"}</td>
                <td>
                  {r.status === "activated" ? <Badge className="bg-success/20 text-success hover:bg-success/20">Active</Badge> :
                   r.status === "claimed" ? <Badge variant="outline" className="border-destructive/40 text-destructive">Claimed</Badge> :
                   <Badge variant="secondary">Registered</Badge>}
                </td>
                <td className="text-muted-foreground">{r.owner_name ?? "—"}</td>
                <td className="text-muted-foreground">{r.expiry_date ? new Date(r.expiry_date).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ProductsPanel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ name: "", sku: "", warranty_months: 24, description: "" });
  const [busy, setBusy] = useState(false);

  function load() {
    supabase.from("products").select("*").order("name").then(({ data }) => setProducts((data ?? []) as never));
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("products").insert(form);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Product added");
    setForm({ name: "", sku: "", warranty_months: 24, description: "" });
    load();
  }

  async function updateMonths(id: string, months: number) {
    const { error } = await supabase.from("products").update({ warranty_months: months }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); load(); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
      <Card className="border-border/60 bg-card/80 p-6">
        <h3 className="flex items-center gap-2 font-semibold"><Plus className="h-4 w-4" /> Add product</h3>
        <form onSubmit={add} className="mt-4 space-y-3">
          <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="space-y-2"><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="font-mono uppercase" required /></div>
          <div className="space-y-2"><Label>Warranty (months)</Label><Input type="number" min={1} value={form.warranty_months} onChange={(e) => setForm({ ...form, warranty_months: parseInt(e.target.value) || 0 })} required /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Adding…" : "Add product"}</Button>
        </form>
      </Card>

      <Card className="border-border/60 bg-card/80 p-6">
        <h3 className="font-semibold">Catalog</h3>
        <div className="mt-4 space-y-3">
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card/60 p-4">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Warranty</Label>
                <Input
                  type="number"
                  min={1}
                  defaultValue={p.warranty_months}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value);
                    if (v && v !== p.warranty_months) updateMonths(p.id, v);
                  }}
                  className="w-20"
                />
                <span className="text-xs text-muted-foreground">months</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
