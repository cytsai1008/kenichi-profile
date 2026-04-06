import { defineMiddleware } from "astro:middleware";
import { locales, defaultLocale, type Locale } from "./i18n/utils";

/** Detect locale from Accept-Language header. */
function detectLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;

  const preferred = acceptLanguage
    .split(",")
    .map((part) => {
      const [lang, q = "q=1"] = part.trim().split(";");
      return { lang: lang.trim().toLowerCase(), q: parseFloat(q.split("=")[1] ?? "1") };
    })
    .sort((a, b) => b.q - a.q)
    .map((p) => p.lang);

  for (const lang of preferred) {
    if (lang === "zh-tw" || lang === "zh-hant") return "zh-tw";
    if (lang === "zh-cn" || lang === "zh-hans" || lang === "zh") return "zh-cn";
    if (lang.startsWith("en")) return "en";
  }
  return defaultLocale;
}

export const onRequest = defineMiddleware(({ request, url, redirect }, next) => {
  const pathname = url.pathname;

  // Only redirect the root path — let all other routes render normally
  if (pathname !== "/") return next();

  // If a locale preference cookie exists, respect it
  const cookies = request.headers.get("cookie") ?? "";
  const localeCookie = cookies
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("preferred-locale="));

  if (localeCookie) {
    const stored = localeCookie.split("=")[1] as Locale;
    if (locales.includes(stored) && stored !== defaultLocale) {
      return redirect(`/${stored}/`, 302);
    }
    return next();
  }

  // Detect from Accept-Language
  const detected = detectLocale(request.headers.get("accept-language"));
  if (detected !== defaultLocale) {
    return redirect(`/${detected}/`, 302);
  }

  return next();
});
