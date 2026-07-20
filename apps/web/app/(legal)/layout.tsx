import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LanguageLinks } from "@/components/language-switcher";

export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("common");

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col px-6 py-12">
      <header className="mb-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          accounting-mcp
        </Link>
      </header>
      <article className="flex-1 space-y-4 text-sm leading-relaxed">{children}</article>
      <footer className="mt-12 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
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
