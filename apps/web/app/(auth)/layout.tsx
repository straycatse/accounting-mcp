import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageLinks } from "@/components/language-switcher";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("common");

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-6">
      <div className="w-full max-w-sm">{children}</div>
      <footer className="flex flex-wrap items-center justify-center gap-x-1.5 text-xs text-muted-foreground">
        <Link href="/terms" className="hover:underline">
          {t("terms")}
        </Link>
        ·
        <Link href="/privacy" className="hover:underline">
          {t("privacy")}
        </Link>
        · Stray Cat AB ·
        <LanguageLinks />
      </footer>
    </div>
  );
}
