/**
 * The paths iOS hands to the BISO app (Universal Links). Only the app's own
 * links belong here: the website's sign-in returns (`/auth/callback`,
 * `/auth/oauth`) must stay in the browser. The static
 * `public/.well-known/apple-app-site-association` mirrors this list; a test
 * keeps them in sync.
 */
export const APP_LINK_COMPONENTS = [
  { "/": "/auth/verify", comment: "app sign-in link" },
  { "/": "/app/*", comment: "app shortcuts and returns" },
];

export type MobilePlatform = "ios" | "android";

/** BISO student app in the Apple App Store (item 6468173379). */
export const APP_STORE_URL = "https://apps.apple.com/app/id6468173379";

/** BISO student app on Google Play (`com.biso.no`). */
export const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.biso.no";

export const APP_STORE_URLS: Record<MobilePlatform, string> = {
  ios: APP_STORE_URL,
  android: GOOGLE_PLAY_URL,
};

export const APP_BANNER_DISMISSED_KEY = "biso_app_banner_dismissed";

const ANDROID_UA = /\bAndroid\b/i;
const IOS_UA = /\b(?:iPhone|iPad|iPod)\b/i;
const MAC_UA = /\bMacintosh\b/i;

/**
 * Detects whether a visitor is on an iOS or Android mobile/tablet device.
 * iPadOS 13+ reports a desktop `Macintosh` user agent with multi-touch points.
 * Returns `null` on desktop browsers so the mobile banner stays hidden there.
 */
export function detectMobilePlatform(
  userAgent: string,
  maxTouchPoints = 0
): MobilePlatform | null {
  if (!userAgent) {
    return null;
  }
  if (ANDROID_UA.test(userAgent)) {
    return "android";
  }
  if (IOS_UA.test(userAgent)) {
    return "ios";
  }
  if (MAC_UA.test(userAgent) && maxTouchPoints > 1) {
    return "ios";
  }
  return null;
}
