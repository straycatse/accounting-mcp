"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "@/i18n/locales";

/**
 * Persist the reader's language choice. Locale lives in a cookie rather than
 * the URL, so this is the only way it changes — every route path stays stable
 * for the absolute URLs the API hands to MCP clients.
 */
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
