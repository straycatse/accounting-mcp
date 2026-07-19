"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ShieldQuestion } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function ConsentForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = searchParams.get("client_name") ?? searchParams.get("client_id") ?? "unknown";
  const scopes = (searchParams.get("scope") ?? "").split(" ").filter(Boolean);

  async function respond(accept: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/oauth2/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accept, oauth_query: window.location.search.slice(1) }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        redirect_uri?: string;
        url?: string;
        error_description?: string;
        message?: string;
        error?: string;
      };
      const target = data.redirect_uri ?? data.url;
      if (res.ok && target) {
        window.location.href = target;
      } else {
        setError(
          `${data.error_description ?? data.message ?? data.error ?? "Consent failed"} (HTTP ${res.status})`,
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldQuestion className="size-4" />
          Authorize access
        </CardTitle>
        <CardDescription>
          Application <code className="rounded bg-muted px-1 py-0.5 font-mono">{client}</code> is
          requesting access with scopes:
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {scopes.length === 0 ? (
            <span className="text-sm text-muted-foreground">(default)</span>
          ) : (
            scopes.map((s) => (
              <Badge key={s} variant="secondary" className="font-mono">
                {s}
              </Badge>
            ))
          )}
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        <Button onClick={() => respond(true)} disabled={busy}>
          Approve
        </Button>
        <Button variant="outline" onClick={() => respond(false)} disabled={busy}>
          Deny
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function ConsentPage() {
  return (
    <Suspense>
      <ConsentForm />
    </Suspense>
  );
}
