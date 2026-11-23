import {
  buildBrowserOptions,
  resolveEnvironment,
} from "@repo/observability/options";
import { captureRouterTransitionStart, init } from "@sentry/nextjs";

// Without a DSN the SDK is disabled and sends nothing. Docs is low-traffic and
// staff-facing, so envelopes go straight to Sentry without a tunnel.
init(
  buildBrowserOptions({
    app: "docs",
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: resolveEnvironment(
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      process.env.NODE_ENV
    ),
  })
);

export const onRouterTransitionStart = captureRouterTransitionStart;
