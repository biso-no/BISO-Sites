import type { Reporter } from "@repo/observability/functions";

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_BAD_REQUEST = 400;

/**
 * Report a handled response to Sentry. Only the status is named: the body can
 * carry content titles and ids, which stay in the function logs. 401 and 403
 * are skipped: the reindex is run by hand from the Console (the function
 * needs no domain), so a wrong secret shows in that execution's response
 * straight away, and if a domain is ever added, scanners would trigger them.
 */
export function reportResponse(reporter: Reporter, status: number): void {
  if (status === HTTP_UNAUTHORIZED || status === HTTP_FORBIDDEN) {
    return;
  }
  if (status >= HTTP_BAD_REQUEST) {
    reporter.captureError(new Error(`search-sync answered ${status}`));
  }
}
