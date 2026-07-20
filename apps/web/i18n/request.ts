import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, isLocale, negotiate } from "./locales";

// No locale segment in the URL: the request's locale comes from the cookie the
// language switcher sets, and — on a first visit, before that cookie exists —
// from Accept-Language. Keeping locale out of the path matters because the API
// hands MCP clients absolute URLs into this app (loginPage/consentPage, the
// OAuth connect redirects), and those must not move.
export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale)
    ? cookieLocale
    : negotiate((await headers()).get("accept-language"));

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
