import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * ePayment webhook event types to subscribe to when registering a webhook.
 * Covers the full payment lifecycle (the order pipeline re-fetches the
 * authoritative payment on every event, so subscribing broadly is safe).
 */
export const VIPPS_WEBHOOK_EVENTS = [
  "epayments.payment.created.v1",
  "epayments.payment.aborted.v1",
  "epayments.payment.expired.v1",
  "epayments.payment.cancelled.v1",
  "epayments.payment.captured.v1",
  "epayments.payment.refunded.v1",
  "epayments.payment.authorized.v1",
  "epayments.payment.terminated.v1",
] as const;

/** The `name` field on an incoming ePayment webhook event. */
export type VippsWebhookEventName =
  | "CREATED"
  | "AUTHORIZED"
  | "CAPTURED"
  | "CANCELLED"
  | "REFUNDED"
  | "ABORTED"
  | "EXPIRED"
  | "TERMINATED";

export interface VippsWebhookEvent {
  amount?: { currency?: string; value: number };
  idempotencyKey?: string | null;
  msn?: string;
  name: VippsWebhookEventName;
  pspReference?: string;
  reference: string;
  success?: boolean;
  timestamp?: string;
}

/** Minimal header bag (case-insensitive lookups done by the caller). */
export interface VippsWebhookHeaders {
  authorization?: string | null;
  host?: string | null;
  "x-ms-content-sha256"?: string | null;
  "x-ms-date"?: string | null;
}

export interface VerifyVippsWebhookInput {
  headers: VippsWebhookHeaders;
  /** HTTP method (defaults to POST). */
  method?: string;
  /** Request path including any query string, e.g. `/api/payment/vipps/callback`. */
  pathAndQuery: string;
  /** The exact raw request body bytes as a UTF-8 string. */
  rawBody: string;
  /** The webhook secret returned by Vipps at registration time. */
  secret: string;
}

// Vipps sends `Authorization: HMAC-SHA256 SignedHeaders=...&Signature=<base64>`.
const SIGNATURE_RE = /Signature=([^&\s]+)/;

/** Constant-time base64 comparison; false on length mismatch or empty input. */
function safeEqualBase64(a: string, b: string): boolean {
  const left = Buffer.from(a, "base64");
  const right = Buffer.from(b, "base64");
  if (left.length === 0 || left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * Verifies an incoming Vipps webhook request per the Webhooks API
 * request-authentication model:
 *  1. `base64(sha256(rawBody))` must equal the `x-ms-content-sha256` header.
 *  2. `base64(hmacSha256(secret, "<METHOD>\n<pathAndQuery>\n<date>;<host>;<hash>"))`
 *     must equal the `Signature=` value from the `Authorization` header.
 */
export function verifyVippsWebhookSignature(input: VerifyVippsWebhookInput): boolean {
  const { headers, pathAndQuery, rawBody, secret } = input;
  const method = (input.method ?? "POST").toUpperCase();
  const date = headers["x-ms-date"];
  const host = headers.host;
  const contentSha = headers["x-ms-content-sha256"];
  const authorization = headers.authorization;

  if (!(secret && date && host && contentSha && authorization)) {
    return false;
  }

  const computedContentSha = createHash("sha256")
    .update(rawBody, "utf8")
    .digest("base64");
  if (!safeEqualBase64(computedContentSha, contentSha)) {
    return false;
  }

  const signedString = `${method}\n${pathAndQuery}\n${date};${host};${contentSha}`;
  const expected = createHmac("sha256", secret)
    .update(signedString, "utf8")
    .digest("base64");
  const provided = SIGNATURE_RE.exec(authorization)?.[1] ?? authorization;
  return safeEqualBase64(expected, provided);
}

/** Parses an ePayment webhook body, returning `null` when it is malformed. */
export function parseVippsWebhookEvent(rawBody: string): VippsWebhookEvent | null {
  try {
    const data = JSON.parse(rawBody) as Partial<VippsWebhookEvent>;
    if (typeof data.reference !== "string" || typeof data.name !== "string") {
      return null;
    }
    return data as VippsWebhookEvent;
  } catch {
    return null;
  }
}
