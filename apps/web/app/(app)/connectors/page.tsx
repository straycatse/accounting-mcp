"use client";

import { ConnectorCards, mcpUrl } from "@/components/connector-cards";
import { CopyField } from "@/components/copy-field";

export default function ConnectorsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Connect your AI assistant</h2>
        <p className="text-sm text-muted-foreground">
          Add this server as a custom connector (MCP) — sign-in happens in the browser when the
          assistant first connects:
        </p>
        <CopyField text={mcpUrl} />
      </div>
      <ConnectorCards />
    </div>
  );
}
