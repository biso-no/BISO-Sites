import {
  buildServerOptions,
  resolveEnvironment,
} from "@repo/observability/options";
import { init } from "@sentry/nextjs";

// Loaded from `register()` on the Node.js runtime. Without a DSN the SDK is
// disabled and sends nothing. `src/app/api/relay/route.ts` forwards the
// browser's envelopes for this DSN; `tunnel: true` keeps its requests out of
// the traces.
init(
  buildServerOptions({
    app: "web",
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: resolveEnvironment(
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      process.env.NODE_ENV
    ),
    tunnel: true,
  })
);
