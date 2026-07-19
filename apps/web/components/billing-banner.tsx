"use client";

import { useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";

export function BillingBanner() {
  const searchParams = useSearchParams();
  const banner =
    searchParams.get("billing") === "required"
      ? "Start your free trial before connecting a company."
      : searchParams.get("billing") === "seats"
        ? "That company would need another seat — add one to your subscription first."
        : "";

  if (!banner) return null;
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>{banner}</AlertTitle>
    </Alert>
  );
}
