"use client";

import { CompaniesList } from "@/components/companies-list";
import { ConnectBokioCard } from "@/components/connect-bokio-card";
import { ConnectTokenForm } from "@/components/connect-token-form";

export default function CompaniesPage() {
  return (
    <div className="space-y-6">
      <CompaniesList />
      <ConnectBokioCard />
      <ConnectTokenForm />
    </div>
  );
}
