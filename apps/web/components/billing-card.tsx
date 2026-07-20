"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("billing");
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
      setBillingError(result.error.message ?? t("failed"));
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
          {t("title")}
          {trialDaysLeft !== null && (
            <Badge variant="secondary">{t("trialBadge", { days: trialDaysLeft })}</Badge>
          )}
        </CardTitle>
        <CardDescription>
          {b.complimentary
            ? t("complimentary")
            : b.subscriptionStatus
              ? trialDaysLeft !== null
                ? t("trialing", { seats: b.seats ?? 1 })
                : t("subscribed", { seats: b.seats ?? 1, status: b.subscriptionStatus })
              : t("none")}
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
          <Button onClick={() => void billingAction("subscribe", 1)}>{t("startTrial")}</Button>
        )}
        {!b.complimentary && b.subscriptionStatus && !b.canConnect && (
          <Button onClick={() => void billingAction("subscribe", b.activeConnections + 1)}>
            {t("addCompany", { total: b.activeConnections + 1 })}
          </Button>
        )}
        {!b.complimentary && b.subscriptionStatus && (
          <Button variant="outline" onClick={() => void billingAction("portal")}>
            {t("manage")}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
