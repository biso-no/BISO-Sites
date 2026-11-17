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

export const TRACE_PROPAGATION_TARGETS: (string | RegExp)[] = [
  /^\/(?!\/)/,
  /^https:\/\/(www\.)?biso\.no(\/|$)/,
  /^https:\/\/(admin|api|docs)\.biso\.no(\/|$)/,
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
}

const baseOptions = ({ app, dsn, environment }: OptionInput) => {
  const trimmedDsn = dsn?.trim() || undefined;
  return {
    dsn: trimmedDsn,
    enabled: Boolean(trimmedDsn),
    environment,
    dataCollection: DATA_COLLECTION,
    ignoreErrors: IGNORE_ERRORS,
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
});

export const buildBrowserOptions = (input: OptionInput) => ({
  ...baseOptions(input),
  tracesSampleRate: SAMPLE_RATES[input.app].browserTraces,
  denyUrls: DENY_URLS,
  tracePropagationTargets: TRACE_PROPAGATION_TARGETS,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
