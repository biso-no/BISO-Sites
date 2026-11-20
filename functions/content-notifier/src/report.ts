import type { Reporter } from "@repo/observability/functions";

const HTTP_BAD_REQUEST = 400;

/**
 * Report a handled response to Sentry. Only the status is named: the body can
 * carry content titles and ids, which stay in the function logs.
 */
export function reportResponse(reporter: Reporter, status: number): void {
  if (status >= HTTP_BAD_REQUEST) {
    reporter.captureError(new Error(`content-notifier answered ${status}`));
  }
}
