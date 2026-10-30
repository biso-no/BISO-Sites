const TRAILING_SLASHES = /\/+$/;

/** The admin sign-in link that returns the reader to `currentUrl`. */
export function signInHref(adminUrl: string, currentUrl: string): string {
  return `${adminUrl.replace(TRAILING_SLASHES, "")}/auth/login?redirectTo=${encodeURIComponent(currentUrl)}`;
}
