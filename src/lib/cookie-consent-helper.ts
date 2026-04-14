/**
 * Helper to get the full cookie object.
 * Returns null if the consent cookie does not exist.
 */
export function getCookie(): any | null {
  if (typeof window === "undefined") return null;

  try {
    const name = "cc_cookie=";
    const ca = document.cookie.split(";");
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i].trim();
      if (c.indexOf(name) === 0) {
        let value = c.substring(name.length, c.length);
        // Handle potential double quotes around the JSON string
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        return JSON.parse(decodeURIComponent(value));
      }
    }
  } catch (e) {
    // ignore parsing errors
  }

  return null;
}

/**
 * Helper to check if the user has made a choice
 */
export function validCookie(): boolean {
  if (typeof window === "undefined") return false;
  return getCookie() !== null;
}

/**
 * Helper to check for cookie consent categories
 */
export function hasConsent(category: string): boolean {
  if (typeof window === "undefined") return false;

  const cookie = getCookie();
  if (!cookie) return false;

  return cookie.categories?.includes(category) || false;
}
