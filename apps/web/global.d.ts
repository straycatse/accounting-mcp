import type en from "./messages/en.json";
import type { Locale } from "./i18n/locales";

// Makes `useTranslations` key-checked against the English catalog, so a typo or
// a removed key fails `pnpm typecheck`. Catalog *parity* (sv having every key
// en has) is a separate concern — see scripts/check-messages.mjs.
declare module "next-intl" {
  interface AppConfig {
    Messages: typeof en;
    Locale: Locale;
  }
}
