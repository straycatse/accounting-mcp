"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CreditCard } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function BillingCard() {
  const trpc = useTRPC();
  const billing = useQuery(trpc.billing.get.queryOptions());
  const [billingError, setBillingError] = useState("");

  async function billingAction(action: "subscribe" | "portal", seats?: number) {
    setBillingError("");
    const returnTo = `${window.location.origin}/dashboard`;
    const result =
      action === "subscribe"
        ? await authClient.subscription.upgrade({
            plan: "standard",
            seats,
            successUrl: returnTo,
            cancelUrl: returnTo,
          })
        : await authClient.subscription.billingPortal({ returnUrl: returnTo });
    if (result.error) {
      setBillingError(result.error.message ?? "Billing request failed");
    } else if (result.data && "url" in result.data && typeof result.data.url === "string") {
      window.location.href = result.data.url;
    }
  }

  const b = billing.data;
  if (!b) {
    return billing.isPending ? <Skeleton className="h-40 w-full" /> : null;
  }
  if (!b.billingEnabled) return null;

  const trialDaysLeft =
    b.trialing && b.trialEnd
      ? Math.ceil((new Date(b.trialEnd).getTime() - Date.now()) / 86400000)
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-4" />
          Subscription
          {trialDaysLeft !== null && (
            <Badge variant="secondary">
              Trial — {trialDaysLeft} {trialDaysLeft === 1 ? "day" : "days"} left
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {b.complimentary
            ? "Complimentary account — no subscription needed."
            : b.subscriptionStatus
              ? trialDaysLeft !== null
                ? `Add a payment method before the trial ends to continue with ${b.seats} ${b.seats === 1 ? "company" : "companies"}; otherwise the subscription simply ends.`
                : `Subscribed — ${b.seats} ${b.seats === 1 ? "company" : "companies"} (status: ${b.subscriptionStatus}).`
              : "Start with a free trial — no card required. Add a payment method before it ends to keep your companies connected."}
        </CardDescription>
      </CardHeader>
      {billingError && (
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>{billingError}</AlertTitle>
          </Alert>
        </CardContent>
      )}
      <CardFooter className="flex flex-wrap gap-2">
        {!b.complimentary && !b.subscriptionStatus && (
          <Button onClick={() => void billingAction("subscribe", 1)}>Start free trial</Button>
        )}
        {!b.complimentary && b.subscriptionStatus && !b.canConnect && (
          <Button onClick={() => void billingAction("subscribe", b.activeConnections + 1)}>
            Add a company ({b.activeConnections + 1} total)
          </Button>
        )}
        {!b.complimentary && b.subscriptionStatus && (
          <Button variant="outline" onClick={() => void billingAction("portal")}>
            Manage billing
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
