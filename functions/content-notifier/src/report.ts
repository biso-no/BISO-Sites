import type { Reporter } from "@repo/observability/functions";

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_BAD_REQUEST = 400;

/**
 * Report a handled response to Sentry. Only the status is named: the body can
 * carry content titles and ids, which stay in the function logs. 401 and 403
 * are skipped: the function has a public domain, so scanners trigger them, and
 * a real secret mismatch shows up as `CONTENT_NOTIFIER_URL failed: 401` plus
 * the `dispatch-content-notifier` monitor on the dispatcher.
 */
export function reportResponse(reporter: Reporter, status: number): void {
  if (status === HTTP_UNAUTHORIZED || status === HTTP_FORBIDDEN) {
    return;
  }
  if (status >= HTTP_BAD_REQUEST) {
    reporter.captureError(new Error(`content-notifier answered ${status}`));
  }
}
