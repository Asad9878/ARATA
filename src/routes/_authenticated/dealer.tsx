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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Plus, QrCode, Package, ExternalLink } from "lucide-react";

type Product = { id: string; name: string; sku: string; warranty_months: number };
type Rim = {
  id: string;
  serial_number: string;
  qr_token: string;
  status: "registered" | "activated" | "claimed";
  expiry_date: string | null;
  owner_name: string | null;
  product: { name: string } | null;
};

export const Route = createFileRoute("/_authenticated/dealer")({
  component: DealerDashboard,
});

function DealerDashboard() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [rims, setRims] = useState<Rim[]>([]);
  const [serial, setSerial] = useState("");
  const [productId, setProductId] = useState("");
  const [busy, setBusy] = useState(false);
  const [qrRim, setQrRim] = useState<Rim | null>(null);

  useEffect(() => {
    supabase.from("products").select("*").order("name").then(({ data }) => setProducts(data ?? []));
    refresh();
  }, [user]);

  async function refresh() {
    if (!user) return;
    const { data } = await supabase
      .from("rims")
      .select("id,serial_number,qr_token,status,expiry_date,owner_name, product:products(name)")
      .eq("dealer_id", user.id)
      .order("created_at", { ascending: false });
    setRims((data ?? []) as never);
  }

  async function registerRim(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !productId) return;
    setBusy(true);
    const { error } = await supabase
      .from("rims")
      .insert({ serial_number: serial.trim().toUpperCase(), product_id: productId, dealer_id: user.id });
    setBusy(false);
    if (error) {
      if (error.code === "23505") toast.error("That serial number is already registered");
      else toast.error(error.message);
      return;
    }
    toast.success("Rim registered");
    setSerial("");
    refresh();
  }

  const stats = {
    total: rims.length,
    active: rims.filter((r) => r.status === "activated").length,
    pending: rims.filter((r) => r.status === "registered").length,
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Dealer portal</p>
          <h1 className="mt-1 text-3xl font-semibold">Inventory & activations</h1>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Stat label="Total rims" value={stats.total} />
          <Stat label="Activated" value={stats.active} accent="ok" />
          <Stat label="Awaiting activation" value={stats.pending} accent="warn" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <Card className="border-border/60 bg-card/80 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Plus className="h-4 w-4" /> Register rim
            </h2>
            <form onSubmit={registerRim} className="mt-4 space-y-4">
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
                <Label>Serial number</Label>
                <Input
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  placeholder="APX-2026-00123"
                  className="font-mono uppercase"
                  required
                />
                <p className="text-xs text-muted-foreground">Must be unique. Duplicates are blocked.</p>
              </div>
              <Button type="submit" className="w-full" disabled={busy || !productId}>
                {busy ? "Registering…" : "Register & generate QR"}
              </Button>
            </form>
          </Card>

          <Card className="border-border/60 bg-card/80 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Package className="h-4 w-4" /> Your rims
            </h2>
            {rims.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">No rims yet. Register your first one to generate a QR code.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                    <tr><th className="py-2">Serial</th><th>Model</th><th>Status</th><th>Owner</th><th>Expires</th><th></th></tr>
                  </thead>
                  <tbody>
                    {rims.map((r) => (
                      <tr key={r.id} className="border-t border-border/60">
                        <td className="py-3 font-mono text-xs">{r.serial_number}</td>
                        <td>{r.product?.name ?? "—"}</td>
                        <td><RimStatus status={r.status} /></td>
                        <td className="text-muted-foreground">{r.owner_name ?? "—"}</td>
                        <td className="text-muted-foreground">{r.expiry_date ? new Date(r.expiry_date).toLocaleDateString() : "—"}</td>
                        <td className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => setQrRim(r)}>
                            <QrCode className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={!!qrRim} onOpenChange={(o) => !o && setQrRim(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>QR Label · {qrRim?.serial_number}</DialogTitle></DialogHeader>
          {qrRim && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="rounded-lg bg-white p-4">
                <QRCodeSVG value={`${window.location.origin}/verify/${qrRim.qr_token}`} size={220} level="H" />
              </div>
              <p className="font-mono text-xs text-muted-foreground break-all">{qrRim.qr_token}</p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/verify/$token" params={{ token: qrRim.qr_token }} target="_blank">
                  Open verify page <ExternalLink className="ml-2 h-3 w-3" />
                </Link>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "ok" | "warn" }) {
  return (
    <Card className="border-border/60 bg-card/60 p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accent === "ok" ? "text-success" : accent === "warn" ? "text-warning" : ""}`}>
        {value}
      </p>
    </Card>
  );
}

function RimStatus({ status }: { status: Rim["status"] }) {
  if (status === "claimed") return <Badge variant="outline" className="border-destructive/40 text-destructive">Claimed</Badge>;
  if (status === "activated") return <Badge className="bg-success/20 text-success hover:bg-success/20">Active</Badge>;
  return <Badge variant="secondary">Registered</Badge>;
}
