"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowRight, Building2, Plug } from "lucide-react";
import { useTRPC } from "@/lib/trpc";
import { StatusBanner } from "@/components/status-banner";
import { BillingCard } from "@/components/billing-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function CompaniesSummaryCard() {
  const t = useTranslations("dashboard");
  const common = useTranslations("common");
  const trpc = useTRPC();
  const connections = useQuery(trpc.connections.list.queryOptions());
  const count = connections.data?.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-4" />
          {t("companiesTitle")}
        </CardTitle>
        <CardDescription>
          {connections.isPending
            ? common("loading")
            : count === 0
              ? t("companiesNone")
              : t("companiesCount", { count })}
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button variant="outline" size="sm" asChild>
          <Link href="/companies">
            {t("manageCompanies")}
            <ArrowRight />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function ConnectorsPointerCard() {
  const t = useTranslations("dashboard");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="size-4" />
          {t("connectorsTitle")}
        </CardTitle>
        <CardDescription>{t("connectorsDescription")}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button variant="outline" size="sm" asChild>
          <Link href="/connectors">
            {t("connectorsCta")}
            <ArrowRight />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <Suspense>
        <StatusBanner />
      </Suspense>
      <BillingCard />
      <div className="grid gap-4 sm:grid-cols-2">
        <CompaniesSummaryCard />
        <ConnectorsPointerCard />
      </div>
    </div>
  );
}
