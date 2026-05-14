import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, QrCode, Award, Sparkles, BadgeCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Asad2flow — Genuine Bike Autoparts Verification" },
      { name: "description", content: "Verify genuine bike autoparts and activate warranty in seconds. Powered by Asad2flow." },
      { property: "og:title", content: "Asad2flow — Genuine Bike Autoparts Verification" },
      { property: "og:description", content: "Verify genuine bike autoparts and activate warranty in seconds." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const [serial, setSerial] = useState("");
  const navigate = useNavigate();

  const verify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serial.trim()) return;
    navigate({ to: "/verify", search: { s: serial.trim() } });
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="relative mx-auto max-w-5xl px-4 pb-24 pt-16 md:pt-28 md:pb-32 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground"
          >
            <Sparkles className="h-3 w-3 text-accent" /> Japanese standard quality
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-6 text-4xl font-semibold tracking-tight md:text-6xl"
          >
            Verify <span className="text-gradient-brand">Genuine Product</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.15 }}
            className="mx-auto mt-4 max-w-xl text-base text-muted-foreground md:text-lg"
          >
            Scan the QR or enter the serial number on your bike autopart to confirm authenticity and activate your warranty.
          </motion.p>

          <motion.form
            onSubmit={verify}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}
            className="mx-auto mt-10 flex max-w-xl flex-col gap-3 sm:flex-row"
          >
            <Input
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="A2F-CG125-X92LK"
              className="h-12 flex-1 glass font-mono text-base"
            />
            <Button type="submit" size="lg" className="h-12 bg-gradient-brand text-primary-foreground hover:opacity-90 shadow-glow">
              <ShieldCheck className="mr-1 h-4 w-4" /> Verify
            </Button>
            <Button type="button" size="lg" variant="outline" className="h-12" onClick={() => alert("Open your camera and scan the QR on the part — it links here automatically.")}>
              <QrCode className="mr-1 h-4 w-4" /> Scan QR
            </Button>
          </motion.form>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: BadgeCheck, title: "Genuine Parts", desc: "Every QR is unique and tamper-evident. One activation per part — no clones." },
            { icon: ShieldCheck, title: "Warranty Benefits", desc: "Instant warranty activation. Track expiry, file claims with one tap." },
            { icon: Award, title: "Japanese Standard", desc: "Built to last. Verified quality from the manufacturer to your bike." },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-2xl glass p-6"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-brand">
                <f.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground md:flex-row">
          <span>© {new Date().getFullYear()} Asad2flow</span>
          <span>Powered by <span className="text-gradient-brand font-medium">Asad2flow</span></span>
        </div>
      </footer>
    </div>
  );
}
