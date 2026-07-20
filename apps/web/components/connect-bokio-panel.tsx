"use client";

import { useTranslations } from "next-intl";
import { ConnectMethod, ConnectOAuthButton, ProviderPanel } from "@/components/connect-provider";
import { ConnectTokenForm } from "@/components/connect-token-form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function ConnectBokioPanel() {
  const t = useTranslations("connect");

  return (
    <ProviderPanel description={t("bokio.description")}>
      <ConnectMethod
        title={t("oauth")}
        badge={<Badge variant="secondary">{t("bokio.oauthBadge")}</Badge>}
        description={t("bokio.oauthDescription")}
      >
        <ConnectOAuthButton href="/connect/bokio" label={t("bokio.connect")} />
      </ConnectMethod>

      <Separator />

      <ConnectMethod
        title={t("bokio.tokenTitle")}
        description={t.rich("bokio.tokenDescription", {
          em: (chunks) => <em>{chunks}</em>,
        })}
      >
        <ConnectTokenForm />
      </ConnectMethod>
    </ProviderPanel>
  );
}
