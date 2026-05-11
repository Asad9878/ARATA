import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Clock, ShieldCheck, FileWarning, Wrench } from "lucide-react";
import { toast } from "sonner";

type Rim = {
  id: string;
  serial_number: string;
  status: "registered" | "activated" | "claimed";
  activation_date: string | null;
  expiry_date: string | null;
  owner_name: string | null;
  owner_email: string | null;
  motorcycle_make: string | null;
  motorcycle_model: string | null;
  product: { name: string; sku: string; warranty_months: number } | null;
};

export const Route = createFileRoute("/verify/$token")({
  component: VerifyPage,
});

function VerifyPage() {
  const { token } = Route.useParams();
  const [rim, setRim] = useState<Rim | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      // Look up by qr_token OR by serial_number (so manual entry works)
      const { data } = await supabase
        .from("rims")
        .select("id,serial_number,status,activation_date,expiry_date,owner_name,owner_email,motorcycle_make,motorcycle_model, product:products(name,sku,warranty_months)")
        .or(`qr_token.eq.${token},serial_number.eq.${token}`)
        .maybeSingle();

      if (!data) setNotFound(true);
      else setRim(data as unknown as Rim);
      setLoading(false);
    })();
  }, [token]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-12">
        {loading ? (
          <Card className="border-border/60 bg-card/60 p-10 text-center text-muted-foreground">
            Verifying…
          </Card>
        ) : notFound ? (
          <NotFoundCard token={token} />
        ) : rim?.status === "registered" ? (
          <ActivationForm rim={rim} onActivated={(updated) => setRim(updated)} />
        ) : rim ? (
          <StatusCard rim={rim} />
        ) : null}
      </div>
    </div>
  );
}

function NotFoundCard({ token }: { token: string }) {
  return (
    <Card className="border-destructive/40 bg-card/80 p-8 shadow-elevated">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-md bg-destructive/15">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Not authentic</h1>
          <p className="text-sm text-muted-foreground">No rim found for code <span className="font-mono">{token}</span></p>
        </div>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        This QR code or serial number is not in our registry. The rim may be counterfeit, or the code was scanned
        incorrectly. Please contact your dealer.
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/">Back home</Link>
      </Button>
    </Card>
  );
}

function StatusCard({ rim }: { rim: Rim }) {
  const expired = rim.expiry_date && new Date(rim.expiry_date) < new Date();
  const daysLeft = rim.expiry_date
    ? Math.ceil((new Date(rim.expiry_date).getTime() - Date.now()) / 86400000)
    : 0;

  return (
    <div className="space-y-4">
      <Card className="border-border/60 bg-card/80 p-8 shadow-elevated">
        <div className="flex items-center gap-3">
          <div className={`grid h-12 w-12 place-items-center rounded-md ${expired ? "bg-warning/15" : "bg-success/15"}`}>
            {expired ? <Clock className="h-6 w-6 text-warning" /> : <ShieldCheck className="h-6 w-6 text-success" />}
          </div>
          <div>
            <h1 className="text-xl font-semibold">Authentic — {rim.product?.name}</h1>
            <p className="font-mono text-xs text-muted-foreground">{rim.serial_number}</p>
          </div>
          <div className="ml-auto">
            <StatusBadge status={rim.status} expired={!!expired} />
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Info label="Product" value={rim.product?.name} />
          <Info label="SKU" value={rim.product?.sku} mono />
          <Info label="Warranty" value={`${rim.product?.warranty_months} months`} />
          <Info label="Activated" value={rim.activation_date ? fmt(rim.activation_date) : "—"} />
          <Info label="Expires" value={rim.expiry_date ? fmt(rim.expiry_date) : "—"} />
          <Info
            label={expired ? "Status" : "Time left"}
            value={expired ? "Expired" : `${daysLeft} days`}
            highlight={expired ? "warn" : "ok"}
          />
        </div>

        {rim.motorcycle_make && (
          <div className="mt-6 border-t border-border/60 pt-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Installed on</p>
            <p className="mt-1 font-medium">
              {rim.motorcycle_make} {rim.motorcycle_model}
            </p>
          </div>
        )}

        <div className="mt-6 border-t border-border/60 pt-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Registered owner</p>
          <p className="mt-1 font-medium">{rim.owner_name ?? "—"}</p>
          <p className="text-sm text-muted-foreground">{maskEmail(rim.owner_email)}</p>
        </div>
      </Card>

      {rim.status !== "claimed" && !expired && (
        <Card className="border-border/60 bg-card/40 p-6">
          <div className="flex items-start gap-3">
            <FileWarning className="mt-1 h-5 w-5 text-warning" />
            <div className="flex-1">
              <h3 className="font-semibold">Need to file a warranty claim?</h3>
              <p className="text-sm text-muted-foreground">
                Submit photos and a description. Our team will review within 2 business days.
              </p>
            </div>
            <Button asChild>
              <Link to="/claim/$rimId" params={{ rimId: rim.id }}>
                <Wrench className="mr-2 h-4 w-4" /> File claim
              </Link>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status, expired }: { status: Rim["status"]; expired: boolean }) {
  if (expired) return <Badge variant="outline" className="border-warning/40 text-warning">Expired</Badge>;
  if (status === "claimed") return <Badge variant="outline" className="border-destructive/40 text-destructive">Claimed</Badge>;
  if (status === "activated") return <Badge className="bg-success/20 text-success hover:bg-success/20">Active</Badge>;
  return <Badge variant="secondary">Awaiting activation</Badge>;
}

function Info({ label, value, mono, highlight }: { label: string; value?: string | null; mono?: boolean; highlight?: "ok" | "warn" }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p
        className={`mt-1 ${mono ? "font-mono" : "font-medium"} ${
          highlight === "ok" ? "text-success" : highlight === "warn" ? "text-warning" : ""
        }`}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}

function ActivationForm({ rim, onActivated }: { rim: Rim; onActivated: (r: Rim) => void }) {
  const [form, setForm] = useState({
    owner_name: "",
    owner_email: "",
    owner_phone: "",
    owner_address: "",
    motorcycle_make: "",
    motorcycle_model: "",
  });
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function activate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase
      .from("rims")
      .update({ ...form, status: "activated" })
      .eq("id", rim.id)
      .select("id,serial_number,status,activation_date,expiry_date,owner_name,owner_email,motorcycle_make,motorcycle_model, product:products(name,sku,warranty_months)")
      .single();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Warranty activated");
    onActivated(data as unknown as Rim);
    // navigate to status (same page now shows status)
    navigate({ to: "/verify/$token", params: { token: rim.serial_number } });
  }

  return (
    <Card className="border-border/60 bg-card/80 p-8 shadow-elevated">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-md bg-accent/15">
          <CheckCircle2 className="h-6 w-6 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Activate your warranty</h1>
          <p className="text-sm text-muted-foreground">
            {rim.product?.name} · <span className="font-mono">{rim.serial_number}</span> ·{" "}
            {rim.product?.warranty_months}-month coverage
          </p>
        </div>
      </div>

      <form onSubmit={activate} className="mt-8 grid gap-4 sm:grid-cols-2">
        <Field label="Full name" value={form.owner_name} onChange={(v) => setForm({ ...form, owner_name: v })} required />
        <Field label="Email" type="email" value={form.owner_email} onChange={(v) => setForm({ ...form, owner_email: v })} required />
        <Field label="Phone" value={form.owner_phone} onChange={(v) => setForm({ ...form, owner_phone: v })} />
        <Field label="Motorcycle make" value={form.motorcycle_make} onChange={(v) => setForm({ ...form, motorcycle_make: v })} />
        <Field label="Motorcycle model" value={form.motorcycle_model} onChange={(v) => setForm({ ...form, motorcycle_model: v })} />
        <div className="sm:col-span-2 space-y-2">
          <Label>Address</Label>
          <Textarea value={form.owner_address} onChange={(e) => setForm({ ...form, owner_address: e.target.value })} rows={2} />
        </div>
        <Button type="submit" className="sm:col-span-2 h-11" disabled={busy}>
          {busy ? "Activating…" : "Activate warranty"}
        </Button>
      </form>
    </Card>
  );
}

function Field({
  label, value, onChange, type = "text", required,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function maskEmail(e: string | null) {
  if (!e) return "—";
  const [u, d] = e.split("@");
  if (!d) return e;
  return `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}`;
}
