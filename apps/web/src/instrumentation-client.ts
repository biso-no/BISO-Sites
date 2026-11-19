import {
  buildBrowserOptions,
  resolveEnvironment,
} from "@repo/observability/options";
import { captureRouterTransitionStart, init } from "@sentry/nextjs";

// Without a DSN the SDK is disabled and sends nothing. `tunnel: true` sends
// envelopes to this Site's own origin (served by `serveTunnelIntegration` in
// sentry.server.config.ts), so ad-blockers don't drop them.
init({
  ...buildBrowserOptions({
    app: "web",
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: resolveEnvironment(
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      process.env.NODE_ENV
    ),
  }),
  tunnel: true,
});

export const onRouterTransitionStart = captureRouterTransitionStart;
