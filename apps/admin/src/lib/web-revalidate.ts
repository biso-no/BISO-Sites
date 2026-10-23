const TRAILING_SLASH = /\/+$/;
const NOTIFY_TIMEOUT_MS = 3000;

type WebsiteTag =
  | "benefits"
  | "departments"
  | "membership-texts"
  | "pages"
  | "partners";

/**
 * Tells the public website to drop its cached data for the given tags so an
 * admin save shows up on the next page view. Best-effort: never throws, and
 * gives up after 3 s so a slow website cannot stall a save.
 */
export async function notifyWebsite(tags: WebsiteTag[]): Promise<void> {
  const base = process.env.NEXT_PUBLIC_WEB_BASE_URL;
  const secret = process.env.CRON_SECRET;
  if (!(base && secret)) {
    console.warn(
      "notifyWebsite skipped: NEXT_PUBLIC_WEB_BASE_URL or CRON_SECRET is not set"
    );
    return;
  }

  try {
    const response = await fetch(
      `${base.replace(TRAILING_SLASH, "")}/api/revalidate`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cron-secret": secret,
        },
        body: JSON.stringify({ tags }),
        cache: "no-store",
        signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
      }
    );
    if (!response.ok) {
      console.error(`notifyWebsite: website answered ${response.status}`);
    }
  } catch (error) {
    console.error("notifyWebsite failed", error);
  }
}
