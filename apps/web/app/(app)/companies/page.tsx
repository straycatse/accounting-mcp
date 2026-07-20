"use client";

import { AddCompanyCard } from "@/components/add-company-card";
import { CompaniesList } from "@/components/companies-list";

export default function CompaniesPage() {
  return (
    <div className="space-y-6">
      <CompaniesList />
      <AddCompanyCard />
    </div>
  );
}
