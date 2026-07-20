"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { useTRPC } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

/**
 * Seat/billing gate, mirrored from the server. Connecting is enforced in
 * services/connections.ts either way — this only avoids offering a button that
 * is guaranteed to fail. Shared so every connect method (OAuth *and* private
 * token) reflects the same state; previously only the OAuth buttons did.
 */
export function useConnectGate() {
  const t = useTranslations("connect.gate");
  const trpc = useTRPC();
  const billing = useQuery(trpc.billing.get.queryOptions());
  const b = billing.data;
  const canConnect = b?.canConnect ?? true;
  const hint =
    b && !b.canConnect
      ? b.subscriptionStatus
        ? t("seats", { seats: b.seats ?? 1 })
        : t("trial")
      : "";
  return { canConnect, hint };
}

export function ConnectGateHint() {
  const { hint } = useConnectGate();
  return hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null;
}

/** The body of one provider's tab: a blurb, then its connection methods. */
export function ProviderPanel({
  description,
  children,
}: {
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6 pt-2">
      <p className="text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}

/** A labelled connection method inside a ProviderPanel. */
export function ConnectMethod({
  title,
  badge,
  description,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          {title}
          {badge}
        </h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function ConnectOAuthButton({ href, label }: { href: string; label: string }) {
  const { canConnect } = useConnectGate();
  return (
    <div className="space-y-2">
      <Button
        disabled={!canConnect}
        onClick={() => {
          window.location.href = href;
        }}
      >
        <ExternalLink />
        {label}
      </Button>
      <ConnectGateHint />
    </div>
  );
}
