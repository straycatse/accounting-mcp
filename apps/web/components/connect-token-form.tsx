"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { useTRPC } from "@/lib/trpc";
import { useConnectGate, ConnectGateHint } from "@/components/connect-provider";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Bokio-only: private integration tokens are a Bokio feature, so this renders
 * inside the Bokio provider section rather than as a standalone card.
 */
export function ConnectTokenForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { canConnect } = useConnectGate();

  const [piToken, setPiToken] = useState("");
  const [piCompany, setPiCompany] = useState("");
  const [piError, setPiError] = useState("");

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.billing.get.queryKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.connections.list.queryKey() });
  };

  const tokenConnect = useMutation(
    trpc.connections.connectViaToken.mutationOptions({
      onSuccess: () => {
        setPiToken("");
        setPiCompany("");
        setPiError("");
        refresh();
      },
      onError: (err) => setPiError(err.message),
    }),
  );

  function submit() {
    if (!piToken.trim() || !piCompany.trim()) {
      setPiError("Enter both the integration token and the company ID.");
      return;
    }
    setPiError("");
    tokenConnect.mutate({ integrationToken: piToken.trim(), companyId: piCompany.trim() });
  }

  return (
    <div className="space-y-4">
      {piError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{piError}</AlertTitle>
        </Alert>
      )}
      <div className="grid gap-2">
        <Label htmlFor="pi-token">Integration token</Label>
        <Input
          id="pi-token"
          type="password"
          autoComplete="off"
          value={piToken}
          onChange={(e) => setPiToken(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pi-company">Company ID</Label>
        <Input
          id="pi-company"
          autoComplete="off"
          placeholder="00000000-0000-0000-0000-000000000000"
          value={piCompany}
          onChange={(e) => setPiCompany(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Button disabled={tokenConnect.isPending || !canConnect} onClick={submit}>
          Connect with token
        </Button>
        <ConnectGateHint />
      </div>
    </div>
  );
}
