import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/activate/$id")({ component: ActivatePage });

const schema = z.object({
  customer_name: z.string().trim().min(2).max(100),
  customer_phone: z.string().trim().min(7).max(20),
  customer_city: z.string().trim().max(100).optional(),
  purchase_date: z.string().min(1),
});

function ActivatePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [inv, setInv] = useState<{ company_id: string; status: string; serial_number: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", customer_city: "", purchase_date: new Date().toISOString().slice(0, 10) });

  useEffect(() => {
    supabase.from("inventory").select("company_id, status, serial_number").eq("id", id).maybeSingle().then(({ data }) => {
      setInv(data);
      setLoading(false);
    });
  }, [id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid input"); return; }
    if (!inv || inv.status !== "unused") { toast.error("This product is already activated."); return; }
    setSubmitting(true);
    const { error } = await supabase.from("activations").insert({
      inventory_id: id,
      company_id: inv.company_id,
      customer_name: parsed.data.customer_name,
      customer_phone: parsed.data.customer_phone,
      customer_city: parsed.data.customer_city || null,
      purchase_date: parsed.data.purchase_date,
      expiry_date: parsed.data.purchase_date, // overwritten by trigger
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setDone(true);
    setTimeout(() => navigate({ to: "/verify", search: { s: inv.serial_number } }), 1500);
  }

  if (loading) return <div className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-md py-20 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div></div>;
  if (!inv) return <div className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-md py-20 text-center text-muted-foreground">Product not found.</div></div>;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-md px-4 py-10">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl glass-strong p-6 shadow-elevated">
          <h1 className="text-2xl font-semibold">Activate Warranty</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{inv.serial_number}</p>

          {done ? (
            <div className="mt-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
              <p className="mt-3 font-medium">Warranty activated!</p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <Field label="Customer name"><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required className="glass" /></Field>
              <Field label="Phone number"><Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} required className="glass" /></Field>
              <Field label="City"><Input value={form.customer_city} onChange={(e) => setForm({ ...form, customer_city: e.target.value })} className="glass" /></Field>
              <Field label="Purchase date"><Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} required className="glass" /></Field>
              <Button type="submit" disabled={submitting} className="w-full h-11 bg-gradient-brand text-primary-foreground hover:opacity-90 shadow-glow">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activate Warranty"}
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
