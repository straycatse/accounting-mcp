"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useTRPC } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ConnectBokioCard() {
  const trpc = useTRPC();
  const billing = useQuery(trpc.billing.get.queryOptions());
  const b = billing.data;

  // Connecting is gated server-side too; this only mirrors it in the UI.
  const canConnect = b?.canConnect ?? true;
  const connectHint =
    b && !b.canConnect
      ? b.subscriptionStatus
        ? `All ${b.seats} ${b.seats === 1 ? "seat is" : "seats are"} in use — add a company to your subscription to connect another.`
        : "Start your free trial to connect a company."
      : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect via Bokio (OAuth)</CardTitle>
        <CardDescription>
          Authorize in Bokio&apos;s own consent screen. Requires our public Bokio app — available
          once approved on the Bokio marketplace.
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-2">
        <Button
          disabled={!canConnect}
          onClick={() => {
            window.location.href = "/connect/bokio";
          }}
        >
          <ExternalLink />
          Connect a Bokio company
        </Button>
        {connectHint && <p className="text-sm text-muted-foreground">{connectHint}</p>}
      </CardFooter>
    </Card>
  );
}
