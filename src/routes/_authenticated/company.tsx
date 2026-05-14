import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader } from "@/components/site-header";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/_authenticated/company")({ component: CompanyPanel });

function CompanyPanel() {
  const { company } = useAuth();
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-16">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl glass-strong p-10 text-center shadow-elevated">
          <Construction className="mx-auto h-10 w-10 text-accent" />
          <h1 className="mt-4 text-2xl font-semibold">Company CRM Panel</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {company ? `Tenant: ${company.company_id}` : "No company assigned to your account."}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Dealers · Products · Inventory & QR · Activations · Claims · Staff — shipping in the next phase.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
