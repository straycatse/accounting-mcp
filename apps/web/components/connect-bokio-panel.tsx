"use client";

import { ConnectMethod, ConnectOAuthButton, ProviderPanel } from "@/components/connect-provider";
import { ConnectTokenForm } from "@/components/connect-token-form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function ConnectBokioPanel() {
  return (
    <ProviderPanel description="Two ways in. Until our public Bokio app clears marketplace review, a private integration token is the path that works today.">
      <ConnectMethod
        title="OAuth"
        badge={<Badge variant="secondary">Pending marketplace approval</Badge>}
        description="Authorize in Bokio's own consent screen. Requires our public Bokio app."
      >
        <ConnectOAuthButton href="/connect/bokio" label="Connect a Bokio company" />
      </ConnectMethod>

      <Separator />

      <ConnectMethod
        title="Private integration token"
        description={
          <>
            Works today with your own company — no marketplace review. In Bokio:{" "}
            <em>Settings → API Tokens → Create Private Integration</em>, then paste the token and
            your company ID (the GUID in your Bokio URL).
          </>
        }
      >
        <ConnectTokenForm />
      </ConnectMethod>
    </ProviderPanel>
  );
}
