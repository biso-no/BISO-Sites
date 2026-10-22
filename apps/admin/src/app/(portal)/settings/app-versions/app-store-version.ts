import "server-only";
import { isVersionString } from "@repo/shared/utils/app-versions";

// Kept out of the "use server" actions module on purpose: every export there
// becomes a server action anyone can call. This is only ever called from the
// server, behind the page's own access check.

const APP_STORE_LOOKUP_URL =
  "https://itunes.apple.com/lookup?bundleId=com.biso.no&country=no";
const APP_STORE_REVALIDATE_SECONDS = 3600;
const APP_STORE_TIMEOUT_MS = 5000;

/** The version live in the App Store, or null when it can't be read. */
export async function fetchAppStoreVersion(): Promise<string | null> {
  try {
    const response = await fetch(APP_STORE_LOOKUP_URL, {
      next: { revalidate: APP_STORE_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(APP_STORE_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as {
      results?: { version?: unknown }[];
    };
    const version = body.results?.[0]?.version;
    return typeof version === "string" && isVersionString(version)
      ? version
      : null;
  } catch {
    return null;
  }
}
