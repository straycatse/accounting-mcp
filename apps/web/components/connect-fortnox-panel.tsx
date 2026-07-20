"use client";

import { useTranslations } from "next-intl";
import { ConnectMethod, ConnectOAuthButton, ProviderPanel } from "@/components/connect-provider";

export function ConnectFortnoxPanel() {
  const t = useTranslations("connect");

  return (
    <ProviderPanel description={t("fortnox.description")}>
      <ConnectMethod title={t("oauth")} description={t("fortnox.oauthDescription")}>
        <ConnectOAuthButton href="/connect/fortnox" label={t("fortnox.connect")} />
      </ConnectMethod>
    </ProviderPanel>
  );
}
