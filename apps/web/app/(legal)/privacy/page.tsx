import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

const SUPPORT_EMAIL = "simon@straycat.se";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.privacy");
  return { title: t("metaTitle") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("legal.privacy");

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <ul className="list-disc space-y-2 pl-5">
        <li>{t("storage")}</li>
        <li>{t("dataUse")}</li>
        <li>{t("audit")}</li>
        <li>{t("payments")}</li>
        <li>
          {t.rich("deletion", {
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
