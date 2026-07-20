"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
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

function SignInForm() {
  const t = useTranslations("signIn");
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result =
        mode === "up"
          ? await authClient.signUp.email({ name: name || email, email, password })
          : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? t("failed"));
        return;
      }
      // Continue the OAuth authorization this login interrupted, if any
      // (MCP clients land here from the API's authorize endpoint).
      const qs = searchParams.toString();
      if (searchParams.has("client_id")) {
        window.location.href = `/api/auth/oauth2/authorize?${qs}`;
      } else {
        window.location.href = "/dashboard";
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "in" ? t("signIn") : t("signUp")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <form onSubmit={submit}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>{error}</AlertTitle>
            </Alert>
          )}
          {mode === "up" && (
            <div className="grid gap-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "in" ? "current-password" : "new-password"}
            />
          </div>
        </CardContent>
        <CardFooter className="mt-6 flex-col gap-2">
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "in" ? t("signIn") : t("signUp")}
          </Button>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
          >
            {mode === "in" ? t("toSignUp") : t("toSignIn")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
