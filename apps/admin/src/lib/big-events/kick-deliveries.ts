import "server-only";

/**
 * Asks the api to start sending queued big event emails now instead of at the
 * next cron tick. Always safe: the route yields while another run is busy.
 * Never throws and never waits for the response. Logs a non-2xx status or a
 * missing env, never the address or the secret.
 */
export function kickDeliveries(): void {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const secret = process.env.CRON_SECRET;
  if (!(apiBase && secret)) {
    console.warn(
      "[big-events] Not kicking the email processor: NEXT_PUBLIC_API_BASE_URL or CRON_SECRET is not set"
    );
    return;
  }
  // Not awaited: the route may stay open for the whole sending run.
  fetch(`${apiBase}/api/cron/big-event-deliveries`, {
    headers: { "x-cron-secret": secret },
    method: "POST",
  })
    .then((res) => {
      if (!res.ok) {
        console.warn(`[big-events] The email processor answered ${res.status}`);
      }
    })
    .catch(() => {
      console.warn("[big-events] Couldn't reach the email processor");
    });
}
