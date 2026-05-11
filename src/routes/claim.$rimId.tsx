import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Wrench } from "lucide-react";

export const Route = createFileRoute("/claim/$rimId")({
  component: ClaimPage,
});

function ClaimPage() {
  const { rimId } = Route.useParams();
  const [rim, setRim] = useState<{ serial_number: string; product: { name: string } | null } | null>(null);
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    issue_description: "",
  });
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from("rims")
      .select("serial_number, product:products(name)")
      .eq("id", rimId)
      .maybeSingle()
      .then(({ data }) => setRim(data as never));
  }, [rimId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("claims").insert({ rim_id: rimId, ...form });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Claim submitted — we'll be in touch within 2 business days");
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card className="border-border/60 bg-card/80 p-8 shadow-elevated">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-md bg-warning/15">
              <Wrench className="h-6 w-6 text-warning" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">File a warranty claim</h1>
              {rim && (
                <p className="text-sm text-muted-foreground">
                  {rim.product?.name} · <span className="font-mono">{rim.serial_number}</span>
                </p>
              )}
            </div>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow label="Your name" value={form.customer_name} onChange={(v) => setForm({ ...form, customer_name: v })} required />
              <FieldRow label="Email" type="email" value={form.customer_email} onChange={(v) => setForm({ ...form, customer_email: v })} required />
              <FieldRow label="Phone" value={form.customer_phone} onChange={(v) => setForm({ ...form, customer_phone: v })} />
            </div>
            <div className="space-y-2">
              <Label>Describe the issue *</Label>
              <Textarea
                rows={5}
                required
                value={form.issue_description}
                onChange={(e) => setForm({ ...form, issue_description: e.target.value })}
                placeholder="Crack on outer lip after first ride. Spoke loosened…"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" asChild>
                <Link to="/">Cancel</Link>
              </Button>
              <Button type="submit" className="flex-1" disabled={busy}>
                {busy ? "Submitting…" : "Submit claim"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

function FieldRow({
  label, value, onChange, type = "text", required,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}
