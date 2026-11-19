import type {
  Breadcrumb,
  ErrorEvent,
  Log,
  Metric,
  StackFrame,
  StreamedSpanJSON,
} from "@sentry/core";

export const REDACTED = "[redacted]";

export const SENSITIVE_HEADERS: ReadonlySet<string> = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "set-cookie",
  "x-api-key",
  "x-appwrite-key",
]);

// These run on the server for every log line. A repeat the engine retries
// from each position is bounded, or a long run (`a-a-a-…`, `a.a.a.…`) makes
// the scan quadratic.
const ACCOUNT_NUMBER = /\b\d{4}[ .]?\d{2}[ .]?\d{5}\b/g;
const NATIONAL_ID = /\b\d{6} ?\d{5}\b/g;
// Local part up to 64 characters, domain up to 253 (the RFC limits). The
// leading group makes a match start only where a run of local-part characters
// starts, so a long run is not rescanned from each of its characters.
const EMAIL =
  /(^|[^A-Za-z0-9._%+-])[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,63}/g;
// Country code, check digits, then 11–30 characters, with or without spaces
// every four (NO93 8601 1117 947, DE89 3704 0044 0532 0130 00).
const IBAN = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b/g;
// An absolute URL inside free text, to its end. The match runs to the next
// space or quote and the search resumes after it, so it stays linear.
const EMBEDDED_URL = /https?:\/\/[^\s"'<>]*/g;
// `secret=…`, `userId=…`, `access_token=…` outside a URL we could parse. The
// leading group stands in for a lookbehind, which older Safari can't parse.
// At most six prefix parts (`oauth_token_secret` has two).
const SECRET_PAIR =
  /(^|[^A-Za-z0-9_])((?:[A-Za-z0-9]+[_-]){0,6}(?:secret|code|state|token|userId|password))=[^&\s"'<>#]*/gi;
const URL_SUFFIX = /[?#].*$/s;
const URL_KEY = /(^|\.)(url|full|target)$|^url/i;
const DROPPED_SPAN_ATTRIBUTES = ["http.query", "url.query"];

type HeaderValue = string | string[] | undefined;
type Mutable = Record<string, unknown>;

// Keeps the address, drops the query and fragment.
const dropUrlSuffix = (url: string): string => url.replace(URL_SUFFIX, "");

export const scrubText = (text: string): string =>
  text
    .replace(EMBEDDED_URL, dropUrlSuffix)
    .replace(SECRET_PAIR, `$1$2=${REDACTED}`)
    .replace(EMAIL, `$1${REDACTED}`)
    .replace(IBAN, REDACTED)
    .replace(ACCOUNT_NUMBER, REDACTED)
    .replace(NATIONAL_ID, REDACTED);

export const scrubUrl = (url: string): string => scrubText(dropUrlSuffix(url));

const REFERER_HEADERS = new Set(["referer", "referrer"]);
const IP_HEADERS = new Set([
  "cf-connecting-ip",
  "forwarded",
  "true-client-ip",
  "x-client-ip",
  "x-forwarded-for",
  "x-real-ip",
]);
const MAX_DEPTH = 6;

const scrubHeaderValue = (name: string, value: HeaderValue): HeaderValue => {
  if (SENSITIVE_HEADERS.has(name) || IP_HEADERS.has(name)) {
    return REDACTED;
  }
  const clean = REFERER_HEADERS.has(name) ? scrubUrl : scrubText;
  if (typeof value === "string") {
    return clean(value);
  }
  return Array.isArray(value) ? value.map(clean) : value;
};

export const redactHeaders = (
  headers: Record<string, HeaderValue> | undefined
): Record<string, HeaderValue> => {
  if (!headers) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      scrubHeaderValue(key.toLowerCase(), value),
    ])
  );
};

const isPlainObject = (value: unknown): value is Mutable =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const scrubValue = (key: string, value: unknown, depth = 0): unknown => {
  if (typeof value === "string") {
    return URL_KEY.test(key) ? scrubUrl(value) : scrubText(value);
  }
  if (depth > MAX_DEPTH) {
    return value !== null && typeof value === "object" ? REDACTED : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(key, item, depth + 1));
  }
  if (isPlainObject(value)) {
    const out = scrubRecord(value, depth + 1);
    // Attribute objects ({ value, unit }): the value inherits the attribute's
    // key, so a URL attribute is still scrubbed as a URL.
    if ("value" in value) {
      out.value = scrubValue(key, value.value, depth + 1);
    }
    return out;
  }
  return value;
};

function scrubRecord(record: Mutable, depth = 0): Mutable {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      scrubValue(key, value, depth),
    ])
  );
}

const scrubBreadcrumbs = (
  breadcrumbs: Breadcrumb[] | undefined
): Breadcrumb[] | undefined => breadcrumbs?.map(scrubBreadcrumb);

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  try {
    const out: Breadcrumb = { ...breadcrumb };
    if (typeof out.message === "string") {
      out.message = scrubText(out.message);
    }
    if (out.data) {
      out.data = scrubRecord(out.data);
    }
    return out;
  } catch {
    return {
      type: breadcrumb.type,
      category: breadcrumb.category,
      level: breadcrumb.level,
      timestamp: breadcrumb.timestamp,
      message: REDACTED,
    };
  }
}

const SAFE_EVENT_FIELDS = [
  "event_id",
  "timestamp",
  "level",
  "platform",
  "release",
  "environment",
  "type",
] as const;

// Used when scrubbing throws: keep identity fields only, drop everything else.
const safeEventFallback = <T extends ErrorEvent>(event: T): T => {
  const out: Mutable = {};
  for (const field of SAFE_EVENT_FIELDS) {
    try {
      out[field] = event[field];
    } catch {
      // drop unreadable field
    }
  }
  try {
    const app = event.tags?.app;
    if (typeof app === "string") {
      out.tags = { app: scrubText(app) };
    }
  } catch {
    // drop tags
  }
  out.message = REDACTED;
  out.exception = { values: [{ type: "Error", value: REDACTED }] };
  return out as T;
};

const scrubRequest = (
  request: NonNullable<ErrorEvent["request"]>
): NonNullable<ErrorEvent["request"]> => {
  const { cookies, data, query_string, headers, url, ...rest } = request;
  return {
    ...rest,
    ...(url === undefined ? {} : { url: scrubUrl(url) }),
    ...(headers
      ? {
          headers: redactHeaders(
            headers as Record<string, HeaderValue>
          ) as typeof headers,
        }
      : {}),
  };
};

// Frame paths are URLs in the browser (`https://biso.no/_next/…?dpl=…`).
const scrubFrame = ({ vars: _vars, ...frame }: StackFrame): StackFrame => ({
  ...frame,
  ...(typeof frame.filename === "string"
    ? { filename: scrubUrl(frame.filename) }
    : {}),
  ...(typeof frame.abs_path === "string"
    ? { abs_path: scrubUrl(frame.abs_path) }
    : {}),
});

const scrubException = (
  exception: NonNullable<ErrorEvent["exception"]>
): NonNullable<ErrorEvent["exception"]> => ({
  ...exception,
  values: exception.values?.map((entry) => ({
    ...entry,
    ...(entry.stacktrace?.frames
      ? {
          stacktrace: {
            ...entry.stacktrace,
            frames: entry.stacktrace.frames.map(scrubFrame),
          },
        }
      : {}),
    ...(typeof entry.value === "string"
      ? { value: scrubText(entry.value) }
      : {}),
  })),
});

export function scrubEvent<T extends ErrorEvent>(event: T): T {
  try {
    const out: T = { ...event };
    if (typeof out.message === "string") {
      out.message = scrubText(out.message);
    }
    if (typeof out.transaction === "string") {
      out.transaction = scrubUrl(out.transaction);
    }
    if (out.request) {
      out.request = scrubRequest(out.request);
    }
    for (const field of ["extra", "tags", "contexts"] as const) {
      if (out[field]) {
        (out as Mutable)[field] = scrubRecord(out[field] as Mutable);
      }
    }
    if (out.logentry) {
      out.logentry = {
        ...out.logentry,
        ...(typeof out.logentry.message === "string"
          ? { message: scrubText(out.logentry.message) }
          : {}),
        ...(out.logentry.params
          ? { params: scrubValue("params", out.logentry.params) as never }
          : {}),
      };
    }
    if (out.user) {
      out.user = out.user.id === undefined ? {} : { id: out.user.id };
    }
    if (out.exception?.values) {
      out.exception = scrubException(out.exception);
    }
    if (out.breadcrumbs) {
      out.breadcrumbs = scrubBreadcrumbs(out.breadcrumbs);
    }
    return out;
  } catch {
    return safeEventFallback(event);
  }
}

export function scrubLog(log: Log): Log {
  try {
    return {
      ...log,
      message: scrubText(String(log.message)),
      ...(log.attributes ? { attributes: scrubRecord(log.attributes) } : {}),
    };
  } catch {
    return { level: log.level, message: REDACTED };
  }
}

export function scrubSpan(span: StreamedSpanJSON): StreamedSpanJSON {
  try {
    const attributes: Mutable = { ...span.attributes };
    for (const key of DROPPED_SPAN_ATTRIBUTES) {
      delete attributes[key];
    }
    return {
      ...span,
      name: scrubUrl(span.name),
      attributes: scrubRecord(attributes) as StreamedSpanJSON["attributes"],
    };
  } catch {
    return {
      trace_id: span.trace_id,
      span_id: span.span_id,
      parent_span_id: span.parent_span_id,
      start_timestamp: span.start_timestamp,
      end_timestamp: span.end_timestamp,
      status: span.status,
      is_segment: span.is_segment,
      name: REDACTED,
      attributes: {},
    };
  }
}

export function scrubMetric(metric: Metric): Metric {
  try {
    return {
      ...metric,
      ...(metric.attributes
        ? { attributes: scrubRecord(metric.attributes) }
        : {}),
    };
  } catch {
    return {
      name: metric.name,
      type: metric.type,
      value: metric.value,
      unit: metric.unit,
    };
  }
}
