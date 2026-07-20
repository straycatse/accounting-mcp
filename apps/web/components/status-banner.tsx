"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";

// The API redirects back here with a *code*, never prose, so the message can be
// rendered in the reader's language: see the `?billing=` and `?error=` redirects
// in apps/api/src/auth/connect-{bokio,fortnox}.ts.
const BILLING_KEYS = {
  required: "billing.required",
  seats: "billing.seats",
} as const;

const ERROR_KEYS = {
  oauth_state: "connect.oauthState",
  oauth_denied: "connect.oauthDenied",
  company_info: "connect.companyInfo",
} as const;

export function StatusBanner() {
  const t = useTranslations("errors");
  const searchParams = useSearchParams();

  const billing = searchParams.get("billing");
  const error = searchParams.get("error");
  const key =
    (billing && BILLING_KEYS[billing as keyof typeof BILLING_KEYS]) ??
    (error && ERROR_KEYS[error as keyof typeof ERROR_KEYS]);

  if (!key) return null;
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>{t(key)}</AlertTitle>
    </Alert>
  );
}
