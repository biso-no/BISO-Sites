import {
  applyReplayConsent,
  readConsentFromDocument,
  stopReplayBeforeNavigation,
} from "@repo/observability/browser/replay";
import {
  buildBrowserOptions,
  resolveEnvironment,
} from "@repo/observability/options";
import {
  browserProfilingIntegration,
  captureRouterTransitionStart,
  init,
} from "@sentry/nextjs";

// Without a DSN the SDK is disabled and sends nothing. `tunnel: true` sends
// envelopes to this Site's own origin (`src/app/api/relay/route.ts`), so
// ad-blockers don't drop them.
init({
  ...buildBrowserOptions({
    app: "admin",
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: resolveEnvironment(
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      process.env.NODE_ENV
    ),
    tunnel: true,
  }),
  // Profiles sampled traces; the rate is in `buildBrowserOptions`. Chromium
  // only, and it needs the `Document-Policy: js-profiling` header (next.config).
  integrations: [browserProfilingIntegration()],
});

// Replay loads and records only if this visitor said yes (consent cookie), and
// never on the pages in `REPLAY_DENYLIST`; otherwise none of its code is
// fetched. Never rejects, so nothing awaits it.
applyReplayConsent("admin", readConsentFromDocument());

// Before the router fetches the next page: Replay stops first if that page is
// never recorded (sign-in links and the like carry secrets in the address).
export function onRouterTransitionStart(
  href: string,
  navigationType: "push" | "replace" | "traverse"
): void {
  stopReplayBeforeNavigation("admin", href);
  captureRouterTransitionStart(href, navigationType);
}
