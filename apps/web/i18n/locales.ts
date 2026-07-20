// Single source of truth for the locales the app ships. Adding a language is a
// new entry here plus the matching messages/<locale>.json.

export const LOCALES = ["sv", "en"] as const;

export type Locale = (typeof LOCALES)[number];

/** Used when Accept-Language names nothing we speak. */
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Native names, for the language switcher — never translated. */
export const LOCALE_LABELS: Record<Locale, string> = {
  sv: "Svenska",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Pick a locale from an Accept-Language header.
 *
 * Deliberately quality-aware rather than "first tag wins": Swedish browsers
 * commonly send `sv-SE,sv;q=0.9,en;q=0.8`, but a Swede who has set English
 * first should get English. Region subtags are dropped (`sv-FI` is still `sv`).
 */
export function negotiate(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2);
      const quality = q === undefined ? 1 : Number.parseFloat(q);
      return {
        language: tag.trim().toLowerCase().split("-")[0],
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .filter((entry) => entry.language && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { language } of ranked) {
    if (isLocale(language)) return language;
  }
  return DEFAULT_LOCALE;
}
