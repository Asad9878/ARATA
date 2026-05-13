import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { ShieldAlert, Plus, Truck, QrCode, ExternalLink, Users } from "lucide-react";

type Product = { id: string; name: string; sku: string; warranty_months: number; description: string | null };
type Dealer = { id: string; name: string; contact_person: string | null; phone: string | null; email: string | null; address: string | null };
type Rim = {
  id: string; serial_number: string; qr_token: string; status: string; expiry_date: string | null;
  owner_name: string | null; dealer_id: string | null; created_at: string;
  product: { name: string } | null;
  dealer: { name: string } | null;
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
            This account does not have admin privileges.
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

        <Tabs defaultValue="dispatch">
          <TabsList className="flex-wrap">
            <TabsTrigger value="dispatch">Dispatch</TabsTrigger>
            <TabsTrigger value="rims">Inventory</TabsTrigger>
            <TabsTrigger value="dealers">Dealers</TabsTrigger>
            <TabsTrigger value="claims">Claims</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
          </TabsList>
          <TabsContent value="dispatch" className="mt-6"><DispatchPanel /></TabsContent>
          <TabsContent value="rims" className="mt-6"><RimsPanel /></TabsContent>
          <TabsContent value="dealers" className="mt-6"><DealersPanel /></TabsContent>
          <TabsContent value="claims" className="mt-6"><ClaimsPanel /></TabsContent>
          <TabsContent value="products" className="mt-6"><ProductsPanel /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ---------------- Dispatch (bulk serial generation) ---------------- */

function DispatchPanel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [productId, setProductId] = useState("");
  const [dealerId, setDealerId] = useState("");
  const [prefix, setPrefix] = useState("");
  const [start, setStart] = useState(1);
  const [qty, setQty] = useState(10);
  const [pad, setPad] = useState(3);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Rim[]>([]);

  useEffect(() => {
    supabase.from("products").select("*").order("name").then(({ data }) => setProducts(data ?? []));
    supabase.from("dealers").select("*").order("name").then(({ data }) => setDealers(data ?? []));
  }, []);

  const preview = Array.from({ length: Math.min(qty, 3) }, (_, i) => `${prefix}${String(start + i).padStart(pad, "0")}`);
  const lastSerial = qty > 0 ? `${prefix}${String(start + qty - 1).padStart(pad, "0")}` : "";

  async function dispatch(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || !dealerId || !prefix || qty < 1) return;
    setBusy(true);
    const rows = Array.from({ length: qty }, (_, i) => ({
      serial_number: `${prefix}${String(start + i).padStart(pad, "0")}`.toUpperCase(),
      product_id: productId,
      dealer_id: dealerId,
    }));
    const { data, error } = await supabase
      .from("rims")
      .insert(rows)
      .select("id,serial_number,qr_token,status,expiry_date,owner_name,dealer_id,created_at, product:products(name), dealer:dealers(name)");
    setBusy(false);
    if (error) {
      if (error.code === "23505") toast.error("One or more serials already exist. Adjust the start number.");
      else toast.error(error.message);
      return;
    }
    toast.success(`Dispatched ${rows.length} rims`);
    setCreated((data ?? []) as never);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card className="border-border/60 bg-card/80 p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold"><Truck className="h-4 w-4" /> Dispatch batch</h3>
        <p className="mt-1 text-sm text-muted-foreground">Generate a serial range and assign it to a dealer in one step.</p>
        <form onSubmit={dispatch} className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder="Select rim model" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.warranty_months}mo)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dealer</Label>
              <Select value={dealerId} onValueChange={setDealerId}>
                <SelectTrigger><SelectValue placeholder="Select dealer" /></SelectTrigger>
                <SelectContent>
                  {dealers.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Serial prefix</Label>
            <Input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              placeholder="APX-2026-X"
              className="font-mono uppercase"
              required
            />
            <p className="text-xs text-muted-foreground">Everything before the running number, e.g. <span className="font-mono">APX-2026-X</span></p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Start #</Label>
              <Input type="number" min={0} value={start} onChange={(e) => setStart(parseInt(e.target.value) || 0)} required />
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" min={1} max={500} value={qty} onChange={(e) => setQty(parseInt(e.target.value) || 0)} required />
            </div>
            <div className="space-y-2">
              <Label>Pad digits</Label>
              <Input type="number" min={1} max={8} value={pad} onChange={(e) => setPad(parseInt(e.target.value) || 1)} required />
            </div>
          </div>

          {prefix && qty > 0 && (
            <div className="rounded-md border border-border/60 bg-card/60 p-3 font-mono text-xs">
              <p className="mb-1 text-muted-foreground">Preview:</p>
              {preview.map((s) => <div key={s}>{s}</div>)}
              {qty > 3 && <div className="text-muted-foreground">… → {lastSerial}</div>}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy || !productId || !dealerId}>
            {busy ? "Dispatching…" : `Dispatch ${qty} rims`}
          </Button>
        </form>
      </Card>

      <Card className="border-border/60 bg-card/80 p-6">
        <h3 className="text-lg font-semibold">Last batch</h3>
        {created.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Newly dispatched rims will appear here with QR codes.</p>
        ) : (
          <div className="mt-4 space-y-2 max-h-[520px] overflow-y-auto">
            {created.map((r) => <RimRow key={r.id} rim={r} />)}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------- Inventory ---------------- */

function RimsPanel() {
  const [rims, setRims] = useState<Rim[]>([]);
  const [q, setQ] = useState("");
  const [dealerFilter, setDealerFilter] = useState<string>("all");
  const [dealers, setDealers] = useState<Dealer[]>([]);

  function load() {
    supabase
      .from("rims")
      .select("id,serial_number,qr_token,status,expiry_date,owner_name,dealer_id,created_at, product:products(name), dealer:dealers(name)")
      .order("created_at", { ascending: false })
      .limit(1000)
      .then(({ data }) => setRims((data ?? []) as never));
  }
  useEffect(() => {
    load();
    supabase.from("dealers").select("*").order("name").then(({ data }) => setDealers(data ?? []));
  }, []);

  const filtered = rims.filter((r) => {
    if (dealerFilter !== "all" && r.dealer_id !== dealerFilter) return false;
    const s = q.toLowerCase();
    if (!s) return true;
    return r.serial_number.toLowerCase().includes(s) || r.owner_name?.toLowerCase().includes(s) || r.dealer?.name.toLowerCase().includes(s);
  });

  return (
    <Card className="border-border/60 bg-card/80 p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input placeholder="Search by serial, owner, dealer…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Select value={dealerFilter} onValueChange={setDealerFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All dealers</SelectItem>
            {dealers.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} rims</span>
      </div>
      <div className="space-y-2">
        {filtered.map((r) => <RimRow key={r.id} rim={r} />)}
        {filtered.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No rims found.</p>}
      </div>
    </Card>
  );
}

function RimRow({ rim }: { rim: Rim }) {
  const [qrOpen, setQrOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-card/60 p-3 text-sm">
      <div className="font-mono text-xs">{rim.serial_number}</div>
      <div className="text-muted-foreground">{rim.product?.name ?? "—"}</div>
      <div className="text-xs text-muted-foreground">→ {rim.dealer?.name ?? "—"}</div>
      <div className="ml-auto flex items-center gap-2">
        {rim.status === "activated" ? <Badge className="bg-success/20 text-success hover:bg-success/20">Active</Badge> :
         rim.status === "claimed" ? <Badge variant="outline" className="border-destructive/40 text-destructive">Claimed</Badge> :
         <Badge variant="secondary">Registered</Badge>}
        {rim.owner_name && <span className="text-xs text-muted-foreground">{rim.owner_name}</span>}
        {rim.expiry_date && <span className="text-xs text-muted-foreground">exp {new Date(rim.expiry_date).toLocaleDateString()}</span>}
        <Button size="sm" variant="ghost" onClick={() => setQrOpen(true)}>
          <QrCode className="h-4 w-4" />
        </Button>
      </div>
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>QR Label · {rim.serial_number}</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="rounded-lg bg-white p-4">
              <QRCodeSVG value={`${window.location.origin}/verify/${rim.qr_token}`} size={220} level="H" />
            </div>
            <p className="font-mono text-xs text-muted-foreground break-all">{rim.qr_token}</p>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/verify/$token" params={{ token: rim.qr_token }} target="_blank">
                Open verify page <ExternalLink className="ml-2 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Dealers ---------------- */

function DealersPanel() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [form, setForm] = useState({ name: "", contact_person: "", phone: "", email: "", address: "" });
  const [busy, setBusy] = useState(false);

  function load() {
    supabase.from("dealers").select("*").order("name").then(({ data }) => setDealers(data ?? []));
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("dealers").insert(form);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Dealer added");
    setForm({ name: "", contact_person: "", phone: "", email: "", address: "" });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this dealer? Existing rims will keep the assignment.")) return;
    const { error } = await supabase.from("dealers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removed"); load(); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
      <Card className="border-border/60 bg-card/80 p-6">
        <h3 className="flex items-center gap-2 font-semibold"><Plus className="h-4 w-4" /> Add dealer</h3>
        <form onSubmit={add} className="mt-4 space-y-3">
          <div className="space-y-2"><Label>Dealer name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Hanif Traders" required /></div>
          <div className="space-y-2"><Label>Contact person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
          <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-2"><Label>Address</Label><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Adding…" : "Add dealer"}</Button>
        </form>
      </Card>

      <Card className="border-border/60 bg-card/80 p-6">
        <h3 className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> Dealer network</h3>
        <div className="mt-4 space-y-2">
          {dealers.length === 0 && <p className="text-sm text-muted-foreground">No dealers yet.</p>}
          {dealers.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card/60 p-4">
              <div>
                <p className="font-medium">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[d.contact_person, d.phone, d.email].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(d.id)}>Remove</Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------------- Claims ---------------- */

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

/* ---------------- Products ---------------- */

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
