import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, ShieldAlert, Loader2, CheckCircle2, Calendar, Store, Package } from "lucide-react";

type Search = { s?: string; t?: string };

export const Route = createFileRoute("/verify")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    s: typeof s.s === "string" ? s.s : undefined,
    t: typeof s.t === "string" ? s.t : undefined,
  }),
  component: VerifyPage,
});

type Result =
  | { kind: "loading" }
  | { kind: "idle" }
  | { kind: "fake" }
  | {
      kind: "ok";
      inventory: { id: string; serial_number: string; status: string; company_id: string };
      product: { name: string; image_url: string | null; warranty_months: number; description: string | null } | null;
      dealer: { dealer_name: string; shop_name: string | null; city: string | null } | null;
      activation: { customer_name: string; expiry_date: string; purchase_date: string } | null;
    };

function VerifyPage() {
  const { s, t } = Route.useSearch();
  const navigate = useNavigate();
  const [serial, setSerial] = useState(s ?? "");
  const [result, setResult] = useState<Result>({ kind: s || t ? "loading" : "idle" });

  useEffect(() => {
    if (s || t) void lookup(s, t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, t]);

  async function lookup(serialQ?: string, tokenQ?: string) {
    setResult({ kind: "loading" });
    let query = supabase.from("inventory").select("id, serial_number, status, company_id, product_id, dealer_id");
    if (tokenQ) query = query.eq("qr_token", tokenQ);
    else if (serialQ) query = query.ilike("serial_number", serialQ);
    const { data: inv } = await query.maybeSingle();
    if (!inv) {
      await supabase.from("fake_scan_attempts").insert({ attempted_serial: serialQ ?? null, attempted_token: tokenQ ?? null });
      setResult({ kind: "fake" });
      return;
    }
    const [{ data: product }, { data: dealer }, { data: activation }] = await Promise.all([
      supabase.from("products").select("name, image_url, warranty_months, description").eq("id", inv.product_id).maybeSingle(),
      inv.dealer_id ? supabase.from("dealers").select("dealer_name, shop_name, city").eq("id", inv.dealer_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("activations").select("customer_name, expiry_date, purchase_date").eq("inventory_id", inv.id).maybeSingle(),
    ]);
    setResult({ kind: "ok", inventory: inv, product, dealer, activation });
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <form
          onSubmit={(e) => { e.preventDefault(); navigate({ to: "/verify", search: { s: serial.trim() } }); }}
          className="flex gap-2 mb-8"
        >
          <Input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Enter serial number" className="h-11 glass font-mono" />
          <Button type="submit" className="h-11 bg-gradient-brand text-primary-foreground hover:opacity-90">Verify</Button>
        </form>

        {result.kind === "loading" && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Verifying…
          </div>
        )}

        {result.kind === "fake" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl glass p-8 border border-destructive/40">
            <ShieldAlert className="h-10 w-10 text-destructive mb-3" />
            <h2 className="text-2xl font-semibold">Not a genuine product</h2>
            <p className="mt-2 text-sm text-muted-foreground">We couldn't verify this serial. It may be counterfeit. Please contact your dealer.</p>
          </motion.div>
        )}

        {result.kind === "ok" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl glass-strong p-6 md:p-8 shadow-elevated">
            <div className="inline-flex items-center gap-2 rounded-full bg-success/15 px-3 py-1 text-xs text-success">
              <CheckCircle2 className="h-3 w-3" /> Genuine Product
            </div>
            <div className="mt-5 flex flex-col md:flex-row gap-6">
              {result.product?.image_url ? (
                <img src={result.product.image_url} alt={result.product.name} className="h-32 w-32 rounded-xl object-cover" />
              ) : (
                <div className="h-32 w-32 rounded-xl bg-gradient-brand/20 flex items-center justify-center">
                  <Package className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-2xl font-semibold">{result.product?.name ?? "Product"}</h2>
                <p className="font-mono text-xs text-muted-foreground mt-1">{result.inventory.serial_number}</p>
                {result.product?.description && <p className="mt-2 text-sm text-muted-foreground">{result.product.description}</p>}
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <InfoRow icon={ShieldCheck} label="Status" value={result.inventory.status === "activated" ? "Warranty Active" : result.inventory.status === "claimed" ? "Claimed" : "Not Activated"} />
              {result.activation && <InfoRow icon={Calendar} label="Expires" value={new Date(result.activation.expiry_date).toLocaleDateString()} />}
              {result.activation && <InfoRow icon={CheckCircle2} label="Owner" value={result.activation.customer_name} />}
              {result.dealer && <InfoRow icon={Store} label="Dealer" value={`${result.dealer.dealer_name}${result.dealer.city ? ` · ${result.dealer.city}` : ""}`} />}
            </div>

            {result.inventory.status === "unused" && (
              <Button className="mt-6 w-full h-11 bg-gradient-brand text-primary-foreground hover:opacity-90 shadow-glow" onClick={() => navigate({ to: "/activate/$id", params: { id: result.inventory.id } })}>
                Activate Warranty
              </Button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg glass p-3">
      <Icon className="h-4 w-4 text-accent" />
      <div className="flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
