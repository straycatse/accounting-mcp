"use client";

import { useTranslations } from "next-intl";
import { ConnectorCards, mcpUrl } from "@/components/connector-cards";
import { CopyField } from "@/components/copy-field";

export default function ConnectorsPage() {
  const t = useTranslations("connectors");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <CopyField text={mcpUrl} />
      </div>
      <ConnectorCards />
    </div>
  );
}
