"use client";

import { ConnectMethod, ConnectOAuthButton, ProviderPanel } from "@/components/connect-provider";

export function ConnectFortnoxPanel() {
  return (
    <ProviderPanel description="Each authorization connects one Fortnox company.">
      <ConnectMethod
        title="OAuth"
        description="You'll be sent to Fortnox's own consent screen to approve access, then returned here."
      >
        <ConnectOAuthButton href="/connect/fortnox" label="Connect a Fortnox company" />
      </ConnectMethod>
    </ProviderPanel>
  );
}
