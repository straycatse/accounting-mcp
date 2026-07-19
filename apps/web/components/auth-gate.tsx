"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const session = authClient.useSession();
  const unauthenticated = !session.isPending && !session.data?.user;

  useEffect(() => {
    if (unauthenticated) {
      window.location.href = "/sign-in";
    }
  }, [unauthenticated]);

  if (session.isPending || unauthenticated) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
