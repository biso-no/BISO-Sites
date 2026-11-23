import { relayTooLarge } from "@repo/observability/relay";
import { POST as forwardEnvelope } from "@sentry/nextjs/tunnel";

/**
 * The browser's Sentry tunnel (`SENTRY_TUNNEL_PATH` in
 * @repo/observability/options). Envelopes reach Sentry through this Site's
 * own origin, where ad-blockers don't drop them. Only envelopes for this
 * Site's DSN (the server SDK's) are forwarded; any other DSN gets a 403, and
 * a body over the size cap gets a 413 before anything is read.
 *
 * A route rather than `serveTunnelIntegration`: that integration hooks Node's
 * HTTP server through a diagnostics channel Bun doesn't publish, so a Site
 * built with Node and run with Bun never answered the tunnel.
 */
export function POST(request: Request): Promise<Response> {
  if (relayTooLarge(request)) {
    return Promise.resolve(new Response(null, { status: 413 }));
  }
  return forwardEnvelope(request);
}
