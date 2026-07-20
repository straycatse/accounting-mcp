"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Check, Languages } from "lucide-react";
import { setLocale } from "@/app/actions/locale";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/locales";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * The locale is a cookie, not a URL segment, so switching means writing the
 * cookie server-side and re-rendering — router.refresh() re-runs the server
 * components (and i18n/request.ts) with the new cookie in place.
 */
function useLocaleSwitch() {
  const active = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const switchTo = (locale: Locale) => {
    if (locale === active) return;
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  };

  return { active, switchTo, pending };
}

/** Rows for the nav-user dropdown (signed in). */
export function LanguageMenuItems({ label }: { label: string }) {
  const { active, switchTo, pending } = useLocaleSwitch();

  return (
    <>
      <DropdownMenuLabel className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
        <Languages className="size-3.5" />
        {label}
      </DropdownMenuLabel>
      {LOCALES.map((locale) => (
        <DropdownMenuItem
          key={locale}
          disabled={pending}
          onSelect={(e) => {
            // Keep the menu open long enough for the transition to commit.
            e.preventDefault();
            switchTo(locale);
          }}
        >
          <Check className={cn("size-4", locale !== active && "invisible")} />
          {LOCALE_LABELS[locale]}
        </DropdownMenuItem>
      ))}
    </>
  );
}

/**
 * Inline link-style switcher for the footers of the signed-out pages (sign-in,
 * OAuth consent) and the legal pages — the places a first-time visitor lands
 * before there is any account to hang a preference on.
 */
export function LanguageLinks() {
  const { active, switchTo, pending } = useLocaleSwitch();

  return (
    <span className="inline-flex items-center gap-1.5">
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          disabled={pending || locale === active}
          onClick={() => switchTo(locale)}
          className={cn(
            "hover:underline",
            locale === active && "font-medium text-foreground",
          )}
        >
          {LOCALE_LABELS[locale]}
        </button>
      ))}
    </span>
  );
}
