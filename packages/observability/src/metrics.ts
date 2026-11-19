import { metrics } from "@sentry/core";

export type MetricName =
  | "payment.completed"
  | "payment.failed"
  | "orders.stuck"
  | "push.sent"
  | "push.failed"
  | "expense.submitted"
  | "expense.booking_failed"
  | "appwrite.slow_request"
  | "appwrite.timeout";

/** The only attribute keys a metric may carry. Never personal data. */
const ALLOWED_ATTRIBUTE_KEYS = [
  "provider",
  "kind",
  "app",
  "client",
  "outcome",
] as const;

export type MetricAttributes = Partial<
  Record<(typeof ALLOWED_ATTRIBUTE_KEYS)[number], string>
>;

const allowedKeys: ReadonlySet<string> = new Set(ALLOWED_ATTRIBUTE_KEYS);

const pickAllowedAttributes = (
  attributes: MetricAttributes | undefined
): Record<string, string> => {
  const picked: Record<string, string> = {};
  if (!attributes) {
    return picked;
  }
  for (const [key, value] of Object.entries(attributes)) {
    if (allowedKeys.has(key) && typeof value === "string") {
      picked[key] = value;
    }
  }
  return picked;
};

/** Counts one business event. Never throws and never changes control flow. */
export const countMetric = (
  name: Exclude<MetricName, "orders.stuck">,
  attributes?: MetricAttributes
): void => {
  try {
    metrics.count(name, 1, { attributes: pickAllowedAttributes(attributes) });
  } catch {
    // Telemetry must never affect the request.
  }
};

/** Records a point-in-time value. Never throws; ignores non-finite values. */
export const gaugeMetric = (
  name: "orders.stuck",
  value: number,
  attributes?: MetricAttributes
): void => {
  try {
    if (!Number.isFinite(value)) {
      return;
    }
    metrics.gauge(name, value, {
      attributes: pickAllowedAttributes(attributes),
    });
  } catch {
    // Telemetry must never affect the request.
  }
};
