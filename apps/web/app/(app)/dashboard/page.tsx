"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, Plug } from "lucide-react";
import { useTRPC } from "@/lib/trpc";
import { BillingBanner } from "@/components/billing-banner";
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
  const trpc = useTRPC();
  const connections = useQuery(trpc.connections.list.queryOptions());
  const count = connections.data?.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-4" />
          Companies
        </CardTitle>
        <CardDescription>
          {connections.isPending
            ? "Loading…"
            : count === 0
              ? "No companies connected yet."
              : `${count} ${count === 1 ? "company" : "companies"} connected.`}
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button variant="outline" size="sm" asChild>
          <Link href="/companies">
            Manage companies
            <ArrowRight />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function ConnectorsPointerCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="size-4" />
          AI Connectors
        </CardTitle>
        <CardDescription>
          Add this server to Claude, ChatGPT, Perplexity, or Gemini as an MCP connector.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button variant="outline" size="sm" asChild>
          <Link href="/connectors">
            Set up your assistant
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
        <BillingBanner />
      </Suspense>
      <BillingCard />
      <div className="grid gap-4 sm:grid-cols-2">
        <CompaniesSummaryCard />
        <ConnectorsPointerCard />
      </div>
    </div>
  );
}
