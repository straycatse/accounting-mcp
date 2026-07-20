"use client";

import { useTranslations } from "next-intl";
import type { TRPCClientErrorLike } from "@trpc/client";

interface I18nErrorData {
  i18n?: { key?: unknown; params?: unknown };
}

/**
 * Turns a tRPC error into a message in the reader's language.
 *
 * The API has no message catalogs — it attaches a catalog key and its params to
 * failures instead (apps/api/src/lib/app-error.ts, surfaced by the router's
 * errorFormatter). Anything without a key — an unexpected server error, a
 * network failure — falls back to the raw message.
 */
export function useErrorMessage() {
  const t = useTranslations("errors");
  // The key arrives as a plain string over the wire, so it can't be statically
  // checked here the way literal call sites are — t.has() is the runtime guard.
  type ErrorKey = Parameters<typeof t>[0];

  return (error: TRPCClientErrorLike<never> | { message: string; data?: unknown }) => {
    const i18n = (error.data as I18nErrorData | undefined)?.i18n;
    if (typeof i18n?.key !== "string") return error.message;
    // Unknown keys can reach a stale client after a deploy; don't render a raw
    // key at the user.
    if (!t.has(i18n.key as ErrorKey)) return error.message;
    // superjson renders an absent `params` as null, which t() won't accept.
    const params =
      typeof i18n.params === "object" && i18n.params !== null
        ? (i18n.params as Record<string, string | number>)
        : undefined;
    return t(i18n.key as ErrorKey, params);
  };
}
