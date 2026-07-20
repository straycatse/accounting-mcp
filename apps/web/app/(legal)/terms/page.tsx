import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

const SUPPORT_EMAIL = "simon@straycat.se";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.terms");
  return { title: t("metaTitle") };
}

export default async function TermsPage() {
  const t = await getTranslations("legal.terms");

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground">{t("intro")}</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>{t("scope")}</li>
        <li>{t("payment")}</li>
        <li>{t("liability")}</li>
        <li>
          {t.rich("support", {
            mail: () => (
              <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-4">
                {SUPPORT_EMAIL}
              </a>
            ),
          })}
        </li>
      </ul>
    </>
  );
}
