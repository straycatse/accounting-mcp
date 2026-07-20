"use client";

import { useTranslations } from "next-intl";
import { ConnectBokioPanel } from "@/components/connect-bokio-panel";
import { ConnectFortnoxPanel } from "@/components/connect-fortnox-panel";
import { PROVIDERS, type ProviderId } from "@/lib/providers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Fortnox first: it's the provider whose OAuth path actually works today,
// so it's the sensible default tab.
const ORDER: ProviderId[] = ["fortnox", "bokio"];

const PANELS: Record<ProviderId, React.ComponentType> = {
  fortnox: ConnectFortnoxPanel,
  bokio: ConnectBokioPanel,
};

export function AddCompanyCard() {
  const t = useTranslations("connect");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("addTitle")}</CardTitle>
        <CardDescription>{t("addDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={ORDER[0]}>
          <TabsList className="w-full sm:w-fit">
            {ORDER.map((id) => (
              <TabsTrigger key={id} value={id}>
                <span
                  aria-hidden
                  className={cn("size-2 rounded-full", PROVIDERS[id].dotClass)}
                />
                {PROVIDERS[id].label}
              </TabsTrigger>
            ))}
          </TabsList>
          {ORDER.map((id) => {
            const Panel = PANELS[id];
            return (
              <TabsContent key={id} value={id}>
                <Panel />
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
