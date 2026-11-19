import type { DataCollection, Options } from "@sentry/core";
import {
  scrubBreadcrumb,
  scrubEvent,
  scrubLog,
  scrubMetric,
  scrubSpan,
} from "./scrub";

export type SentryApp = "web" | "admin" | "api" | "docs";

export const SAMPLE_RATES: Record<
  SentryApp,
  { serverTraces: number; browserTraces: number }
> = {
  web: { serverTraces: 1, browserTraces: 0.25 },
  admin: { serverTraces: 1, browserTraces: 1 },
  api: { serverTraces: 1, browserTraces: 0 },
  docs: { serverTraces: 1, browserTraces: 0.25 },
};

export const DATA_COLLECTION: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  frameContextLines: 0,
};

/** Browser noise: layout warnings and requests the visitor cancelled. */
export const IGNORE_ERRORS: (string | RegExp)[] = [
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  "AbortError",
  "The operation was aborted",
  "The user aborted a request",
];

export const DENY_URLS: RegExp[] = [
  /^chrome-extension:\/\//,
  /^moz-extension:\/\//,
  /^safari-extension:\/\//,
  /^safari-web-extension:\/\//,
];

/**
 * Outgoing server requests carry `sentry-trace` and `baggage` only to BISO's
 * own Sites, and to localhost in development. Never to Appwrite or a third
 * party (Vipps, Stripe, Finago, Graph, OpenAI, Anthropic). Without this list
 * the server SDK adds them to every request.
 */
export const SERVER_TRACE_PROPAGATION_TARGETS: RegExp[] = [
  /^https:\/\/(?:(?:www|admin|api|docs)\.)?biso\.no(?:[/?#]|$)/,
  /^http:\/\/localhost(?::\d+)?(?:[/?#]|$)/,
];

/**
 * Same-origin path the web and admin browsers send their envelopes to. Each
 * of those apps serves it with `src/app/api/relay/route.ts`, which forwards
 * envelopes for the Site's own DSN only.
 */
export const SENTRY_TUNNEL_PATH = "/api/relay";

/**
 * The tunnel's own requests, which the server doesn't trace: Next's request
 * span (matched on `http.target`, the only path it carries when spans start)
 * and the route handler's span. The same filters @sentry/nextjs uses for its
 * own tunnel route.
 */
export const TUNNEL_IGNORE_SPANS: { attributes: Record<string, RegExp> }[] = [
  {
    attributes: {
      "next.span_type": /^BaseServer\.handleRequest$/,
      "http.target": new RegExp(`^${SENTRY_TUNNEL_PATH}/?(?:\\?|$)`),
    },
  },
  {
    attributes: {
      "next.span_type": /^AppRouteRouteHandlers\.runHandler$/,
      "next.route": new RegExp(`^${SENTRY_TUNNEL_PATH}(?:/route)?$`),
    },
  },
];

export const resolveEnvironment = (
  explicit: string | undefined,
  nodeEnv: string | undefined
): string => {
  const trimmed = explicit?.trim();
  if (trimmed) {
    return trimmed;
  }
  return nodeEnv === "production" ? "production" : "development";
};

export interface OptionInput {
  app: SentryApp;
  dsn: string | undefined;
  environment: string;
  /** The app serves `SENTRY_TUNNEL_PATH` (web and admin). */
  tunnel?: boolean;
}

const baseOptions = ({ app, dsn, environment }: OptionInput) => {
  const trimmedDsn = dsn?.trim() || undefined;
  return {
    dsn: trimmedDsn,
    enabled: Boolean(trimmedDsn),
    environment,
    dataCollection: DATA_COLLECTION,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
    beforeSendLog: scrubLog,
    beforeSendSpan: scrubSpan,
    beforeSendMetric: scrubMetric,
    initialScope: { tags: { app } },
  } satisfies Options;
};

export const buildServerOptions = (input: OptionInput) => ({
  ...baseOptions(input),
  tracesSampleRate: SAMPLE_RATES[input.app].serverTraces,
  tracePropagationTargets: SERVER_TRACE_PROPAGATION_TARGETS,
  ...(input.tunnel ? { ignoreSpans: TUNNEL_IGNORE_SPANS } : {}),
});

// No `tracePropagationTargets` in the browser: unset, the SDK adds trace
// headers to same-origin requests only (`shouldAttachHeaders` in
// @sentry/browser `tracing/request.js`). A cross-origin match, such as
// api.biso.no from biso.no, would fail the CORS preflight.
export const buildBrowserOptions = (input: OptionInput) => ({
  ...baseOptions(input),
  tracesSampleRate: SAMPLE_RATES[input.app].browserTraces,
  ignoreErrors: IGNORE_ERRORS,
  denyUrls: DENY_URLS,
  ...(input.tunnel ? { tunnel: SENTRY_TUNNEL_PATH } : {}),
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
