import {
  buildServerOptions,
  resolveEnvironment,
} from "@repo/observability/options";
import { init, serveTunnelIntegration } from "@sentry/nextjs";

// Loaded from `register()` on the Node.js runtime. Without a DSN the SDK is
// disabled and sends nothing. The tunnel integration answers the browser's
// `tunnel: true` envelopes on this Site's own origin.
init({
  ...buildServerOptions({
    app: "web",
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: resolveEnvironment(
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      process.env.NODE_ENV
    ),
  }),
  integrations: [serveTunnelIntegration()],
});
