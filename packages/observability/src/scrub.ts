import { SENSITIVE_HEADERS } from "@repo/shared/utils/server-error-logging";
import type {
  Breadcrumb,
  ErrorEvent,
  Log,
  Metric,
  StreamedSpanJSON,
} from "@sentry/core";

export const REDACTED = "[redacted]";

const ACCOUNT_NUMBER = /\b\d{4}[ .]?\d{2}[ .]?\d{5}\b/g;
const NATIONAL_ID = /\b\d{6} ?\d{5}\b/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const URL_SUFFIX = /[?#].*$/s;
const URL_KEY = /(^|\.)(url|full|target)$|^url/i;
const DROPPED_SPAN_ATTRIBUTES = ["http.query", "url.query"];

type HeaderValue = string | string[] | undefined;
type Mutable = Record<string, unknown>;

export const scrubText = (text: string): string =>
  text
    .replace(EMAIL, REDACTED)
    .replace(ACCOUNT_NUMBER, REDACTED)
    .replace(NATIONAL_ID, REDACTED);

export const scrubUrl = (url: string): string =>
  scrubText(url.replace(URL_SUFFIX, ""));

export const redactHeaders = (
  headers: Record<string, HeaderValue> | undefined
): Record<string, HeaderValue> => {
  if (!headers) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      SENSITIVE_HEADERS.has(key.toLowerCase()) ? REDACTED : value,
    ])
  );
};

const scrubValue = (key: string, value: unknown): unknown => {
  if (typeof value === "string") {
    return URL_KEY.test(key) ? scrubUrl(value) : scrubText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(key, item));
  }
  if (value && typeof value === "object" && "value" in value) {
    const attribute = value as { value: unknown };
    return { ...attribute, value: scrubValue(key, attribute.value) };
  }
  return value;
};

const scrubRecord = (record: Mutable): Mutable =>
  Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, scrubValue(key, value)])
  );

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
    return { ...breadcrumb, message: REDACTED, data: undefined };
  }
}

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
      const { cookies, data, query_string, headers, url, ...rest } =
        out.request;
      out.request = {
        ...rest,
        ...(url === undefined ? {} : { url: scrubUrl(url) }),
        ...(headers
          ? { headers: redactHeaders(headers as Record<string, HeaderValue>) }
          : {}),
      } as typeof out.request;
    }
    if (out.user) {
      out.user = out.user.id === undefined ? {} : { id: out.user.id };
    }
    if (out.exception?.values) {
      out.exception = {
        ...out.exception,
        values: out.exception.values.map((exception) => ({
          ...exception,
          ...(typeof exception.value === "string"
            ? { value: scrubText(exception.value) }
            : {}),
        })),
      };
    }
    if (out.breadcrumbs) {
      out.breadcrumbs = scrubBreadcrumbs(out.breadcrumbs);
    }
    return out;
  } catch {
    return { ...event, message: REDACTED, exception: undefined };
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
    return { ...log, message: REDACTED, attributes: undefined };
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
    return { ...span, name: REDACTED, attributes: {} };
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
    return { ...metric, attributes: undefined };
  }
}
