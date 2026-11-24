import "server-only";

/**
 * Asks the api to start sending queued big event emails now instead of at the
 * next cron tick. Always safe: the route yields while another run is busy.
 * Never throws and never waits for the response.
 */
export function kickDeliveries(): void {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const secret = process.env.CRON_SECRET;
  if (!(apiBase && secret)) {
    return;
  }
  // Not awaited: the route may stay open for the whole sending run.
  fetch(`${apiBase}/api/cron/big-event-deliveries`, {
    headers: { "x-cron-secret": secret },
    method: "POST",
  }).catch(() => {
    console.warn("[big-events] Couldn't reach the email processor");
  });
}
