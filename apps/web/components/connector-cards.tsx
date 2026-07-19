"use client";

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

export function ConnectorCards() {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Claude</CardTitle>
          <CardDescription>
            Settings → Connectors → <em>Add custom connector</em>, paste the MCP URL above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" asChild>
            <a href="https://claude.ai/settings/connectors" target="_blank" rel="noopener">
              <ExternalLink />
              Open Claude settings
            </a>
          </Button>
          <p className="text-sm text-muted-foreground">Claude Code:</p>
          <CopyField text={`claude mcp add --transport http accounting ${mcpUrl}`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ChatGPT</CardTitle>
          <CardDescription>
            Requires developer mode (Pro/Team/Enterprise): Settings → Connectors →{" "}
            <em>Advanced settings</em> → enable <em>Developer mode</em>, then <em>Create</em> a
            connector with the MCP URL above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <a href="https://chatgpt.com/#settings/Connectors" target="_blank" rel="noopener">
              <ExternalLink />
              Open ChatGPT settings
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Perplexity</CardTitle>
          <CardDescription>
            Settings → Connectors → <em>Add connector</em> → Remote, paste the MCP URL above and
            choose OAuth authentication.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <a
              href="https://www.perplexity.ai/help-center/en/articles/13915507-adding-custom-remote-connectors"
              target="_blank"
              rel="noopener"
            >
              <ExternalLink />
              Open Perplexity guide
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gemini</CardTitle>
          <CardDescription>
            The Gemini web app doesn&apos;t support custom MCP connectors yet — use Gemini CLI:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CopyField text={`gemini mcp add --transport http accounting ${mcpUrl}`} />
        </CardContent>
      </Card>
    </div>
  );
}
