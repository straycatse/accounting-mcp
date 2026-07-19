"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, KeyRound } from "lucide-react";
import { useTRPC } from "@/lib/trpc";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConnectTokenForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" />
          Connect with a private integration token
        </CardTitle>
        <CardDescription>
          Works today with your own company — no marketplace review. In Bokio:{" "}
          <em>Settings → API Tokens → Create Private Integration</em>, then paste the token and
          your company ID (the GUID in your Bokio URL) below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
      <CardFooter>
        <Button disabled={tokenConnect.isPending} onClick={submit}>
          Connect with token
        </Button>
      </CardFooter>
    </Card>
  );
}
