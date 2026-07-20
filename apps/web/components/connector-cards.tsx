"use client";

import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { CopyField } from "@/components/copy-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const mcpUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}/mcp`;

// Each assistant names its own settings differently per language, so the
// step-by-step text is translated; the product names and CLI commands are not.
const em = (chunks: React.ReactNode) => <em>{chunks}</em>;

export function ConnectorCards() {
  const t = useTranslations("connectors");

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Claude</CardTitle>
          <CardDescription>{t.rich("claudeDescription", { em })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" asChild>
            <a href="https://claude.ai/settings/connectors" target="_blank" rel="noopener">
              <ExternalLink />
              {t("claudeButton")}
            </a>
          </Button>
          <p className="text-sm text-muted-foreground">{t("claudeCode")}</p>
          <CopyField text={`claude mcp add --transport http accounting ${mcpUrl}`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ChatGPT</CardTitle>
          <CardDescription>{t.rich("chatgptDescription", { em })}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <a href="https://chatgpt.com/#settings/Connectors" target="_blank" rel="noopener">
              <ExternalLink />
              {t("chatgptButton")}
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Perplexity</CardTitle>
          <CardDescription>{t.rich("perplexityDescription", { em })}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <a
              href="https://www.perplexity.ai/help-center/en/articles/13915507-adding-custom-remote-connectors"
              target="_blank"
              rel="noopener"
            >
              <ExternalLink />
              {t("perplexityButton")}
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gemini</CardTitle>
          <CardDescription>{t("geminiDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <CopyField text={`gemini mcp add --transport http accounting ${mcpUrl}`} />
        </CardContent>
      </Card>
    </div>
  );
}
