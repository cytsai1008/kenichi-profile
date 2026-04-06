import en from "./en.json";
import zhCn from "./zh-cn.json";
import zhTw from "./zh-tw.json";

export type Locale = "en" | "zh-tw" | "zh-cn";
export const locales: Locale[] = ["en", "zh-tw", "zh-cn"];
export const defaultLocale: Locale = "en";

const translations = { en, "zh-tw": zhTw, "zh-cn": zhCn } as const;

type TranslationKeys = typeof en;

/** Get the translation object for a given locale. */
export function t(locale: Locale): TranslationKeys {
  return translations[locale] ?? translations[defaultLocale];
}

/** Get the locale from an Astro URL or pathname. */
export function getLocaleFromUrl(url: URL): Locale {
  const [, first] = url.pathname.split("/");
  if (first === "zh-tw" || first === "zh-cn") return first;
  return defaultLocale;
}

/** Build a locale-prefixed path.
 *  English has no prefix (prefixDefaultLocale: false).
 */
export function localePath(path: string, locale: Locale): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (locale === defaultLocale) return cleanPath;
  return `/${locale}${cleanPath}`;
}

/** Switch the current URL to another locale. */
export function switchLocalePath(url: URL, targetLocale: Locale): string {
  const locale = getLocaleFromUrl(url);
  let pathname = url.pathname;

  // Strip current locale prefix
  if (locale !== defaultLocale) {
    pathname = pathname.replace(`/${locale}`, "") || "/";
  }

  return localePath(pathname, targetLocale);
}

/** Split a translation string on \n into non-empty paragraphs. */
export function nl(text: string): string[] {
  return text.split("\n").filter((line) => line.trim() !== "");
}

/** Map of locales to their BCP 47 language tags for HTML lang attribute. */
export const localeLang: Record<Locale, string> = {
  en: "en",
  "zh-tw": "zh-TW",
  "zh-cn": "zh-CN",
};
