import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  // next-intl v4 uses requestLocale (not locale)
  let locale = await requestLocale;

  // Validate against supported locales
  if (!locale || !routing.locales.includes(locale as "tr" | "en")) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});