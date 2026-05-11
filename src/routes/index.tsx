import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleGauge, QrCode, ShieldCheck, Wrench, Zap } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [serial, setSerial] = useState("");
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 grid-bg opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Authenticated rim warranty network
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
              Every rim accounted for.
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Every warranty traceable.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              RimGuard issues a tamper-evident QR seal for every motorcycle rim. Dealers register, customers
              activate, admins resolve claims — all in one industrial-grade portal.
            </p>

            <form
              className="mt-10 flex w-full max-w-xl gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (serial.trim()) navigate({ to: "/verify/$token", params: { token: serial.trim() } });
              }}
            >
              <input
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="Enter QR code or serial number"
                className="flex h-12 flex-1 rounded-md border border-input bg-card/60 px-4 font-mono text-sm uppercase tracking-wider outline-none focus:border-ring focus:shadow-glow"
              />
              <Button type="submit" size="lg" className="h-12 px-6">
                <QrCode className="mr-2 h-4 w-4" /> Verify
              </Button>
            </form>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "Anti-counterfeit", desc: "Unique serial + cryptographic QR token. Duplicates blocked at the database." },
              { icon: Zap, title: "Instant activation", desc: "Customers scan the rim, fill in their details, warranty starts immediately." },
              { icon: Wrench, title: "Frictionless claims", desc: "Photo evidence, status tracking, dealer + admin notifications." },
            ].map(({ icon: I, title, desc }) => (
              <Card key={title} className="border-border/60 bg-card/40 p-6 backdrop-blur">
                <I className="mb-3 h-6 w-6 text-accent" />
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border/60 bg-gradient-steel p-8 shadow-elevated">
            <CircleGauge className="mb-4 h-8 w-8 text-primary" />
            <h2 className="text-2xl font-semibold">For Dealers</h2>
            <p className="mt-2 text-muted-foreground">
              Register every rim you receive, generate QR labels, and track activations across your customers.
            </p>
            <Button className="mt-6" asChild>
              <Link to="/login">Dealer sign in</Link>
            </Button>
          </Card>
          <Card className="border-border/60 bg-card/60 p-8 shadow-elevated">
            <ShieldCheck className="mb-4 h-8 w-8 text-accent" />
            <h2 className="text-2xl font-semibold">For Customers</h2>
            <p className="mt-2 text-muted-foreground">
              Scan the QR code on your rim to activate your warranty or check the status anytime.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => document.querySelector("input")?.focus()}>
              Verify a rim
            </Button>
          </Card>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        RimGuard © {new Date().getFullYear()} — Industrial warranty infrastructure
      </footer>
    </div>
  );
}
