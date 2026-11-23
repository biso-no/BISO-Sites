import {
  buildServerOptions,
  resolveEnvironment,
} from "@repo/observability/options";
import { init } from "@sentry/nextjs";

// Loaded from `register()` on the Node.js runtime. Without a DSN the SDK is
// disabled and sends nothing. The API serves no pages, so there is no browser
// side and no tunnel.
init(
  buildServerOptions({
    app: "api",
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: resolveEnvironment(
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      process.env.NODE_ENV
    ),
  })
);
