/**
 * SMTP mail transport shared by every app that has to reach an address which is
 * NOT an Appwrite user.
 *
 * Appwrite Messaging can only address *targets* — rows that hang off an
 * Appwrite user account — so `messaging.createEmail(..., targets)` silently
 * fails to deliver when handed a plain address. Whistleblowing recipients,
 * page-form inboxes and other external contacts are ordinary mailboxes that
 * may never sign in, so those flows send over SMTP instead.
 *
 * Configure with:
 *   SMTP_HOST      (required)   e.g. smtp.office365.com
 *   SMTP_PORT      (default 587)
 *   SMTP_SECURE    (default: true when port is 465) implicit TLS
 *   SMTP_USER      (optional)   omit for relays that authenticate by IP
 *   SMTP_PASSWORD  (optional)
 *   SMTP_FROM      (required)   e.g. "BISO <noreply@biso.no>"
 *   SMTP_ALLOW_INSECURE (optional) set "true" ONLY for a trusted relay that
 *                  cannot do STARTTLS — see `requireTls` below.
 */

import "server-only";
import { createTransport, type Transporter } from "nodemailer";

const DEFAULT_SMTP_PORT = 587;
const IMPLICIT_TLS_PORT = 465;
const POOL_MAX_CONNECTIONS = 3;
const POOL_MAX_MESSAGES = 50;
const CONNECTION_TIMEOUT_MS = 10_000;
const GREETING_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 20_000;

export interface SmtpConfig {
  from: string;
  host: string;
  password?: string;
  port: number;
  /** Whether STARTTLS is mandatory. Only meaningful when `secure` is false. */
  requireTls: boolean;
  secure: boolean;
  user?: string;
}

export interface SendEmailParams {
  bcc?: string[];
  cc?: string[];
  /** Overrides `SMTP_FROM`. Must be a mailbox the relay is allowed to send as. */
  from?: string;
  html: string;
  /** Where a reply goes — used to route answers back to a reporter who left an address. */
  replyTo?: string;
  subject: string;
  /** Plain-text alternative. Always worth sending: it lifts deliverability. */
  text?: string;
  to: string | string[];
}

function parsePort(raw: string | undefined): number {
  if (!raw) {
    return DEFAULT_SMTP_PORT;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SMTP_PORT;
}

function parseSecure(raw: string | undefined, port: number): boolean {
  if (raw === undefined || raw === "") {
    // 465 is implicit TLS; 587/25 start plaintext and upgrade via STARTTLS.
    return port === IMPLICIT_TLS_PORT;
  }
  return raw === "true" || raw === "1";
}

/** Reads SMTP settings from the environment, or `null` when none are set. */
export function readSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  if (!(host && from)) {
    return null;
  }

  const port = parsePort(process.env.SMTP_PORT);

  return {
    from,
    host,
    password: process.env.SMTP_PASSWORD || undefined,
    port,
    // On 587/25 nodemailer only upgrades when the server advertises STARTTLS,
    // and otherwise sends in the clear. For whistleblowing reports — and the
    // relay password — silently falling back to plaintext is not acceptable,
    // so demand the upgrade and fail the send when it is unavailable. The
    // escape hatch exists for a trusted relay that genuinely cannot do TLS.
    requireTls: process.env.SMTP_ALLOW_INSECURE !== "true",
    secure: parseSecure(process.env.SMTP_SECURE, port),
    user: process.env.SMTP_USER || undefined,
  };
}

/** True when SMTP_HOST and SMTP_FROM are both configured. */
export function isSmtpConfigured(): boolean {
  return readSmtpConfig() !== null;
}

function requireSmtpConfig(): SmtpConfig {
  const config = readSmtpConfig();
  if (!config) {
    throw new Error(
      "SMTP is not configured — set SMTP_HOST and SMTP_FROM (plus SMTP_USER/SMTP_PASSWORD when the relay requires authentication)."
    );
  }
  return config;
}

let cachedTransporter: Transporter | null = null;
let cachedKey: string | null = null;

function transporterKey(config: SmtpConfig): string {
  return `${config.host}:${config.port}:${config.secure}:${config.requireTls}:${config.user ?? ""}`;
}

/**
 * Pooled transporter, reused across requests so a burst of mails shares one
 * authenticated connection instead of renegotiating TLS per message. Rebuilt if
 * the environment ever changes underneath us.
 */
function getTransporter(): Transporter {
  const config = requireSmtpConfig();
  const key = transporterKey(config);

  if (cachedTransporter && cachedKey === key) {
    return cachedTransporter;
  }

  cachedTransporter?.close();
  cachedTransporter = createTransport({
    auth: config.user
      ? { user: config.user, pass: config.password }
      : undefined,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    host: config.host,
    maxConnections: POOL_MAX_CONNECTIONS,
    maxMessages: POOL_MAX_MESSAGES,
    pool: true,
    port: config.port,
    // No-op when `secure` is true (the connection is already TLS from the
    // first byte); decisive on 587/25, where it turns a silent plaintext
    // fallback into a hard failure.
    requireTLS: config.requireTls,
    secure: config.secure,
    socketTimeout: SOCKET_TIMEOUT_MS,
  });
  cachedKey = key;

  return cachedTransporter;
}

export interface SendEmailResult {
  accepted: string[];
  messageId: string;
  rejected: string[];
}

/**
 * Sends one email over SMTP. Throws when SMTP is unconfigured, when the relay
 * refuses the message, or when every recipient was rejected — callers must
 * treat a rejection as a failed delivery rather than reporting success.
 */
export async function sendEmail(
  params: SendEmailParams
): Promise<SendEmailResult> {
  const config = requireSmtpConfig();

  const info = await getTransporter().sendMail({
    bcc: params.bcc,
    cc: params.cc,
    from: params.from ?? config.from,
    html: params.html,
    replyTo: params.replyTo,
    subject: params.subject,
    text: params.text,
    to: params.to,
  });

  const accepted = (info.accepted ?? []).map(String);
  const rejected = (info.rejected ?? []).map(String);

  if (accepted.length === 0) {
    throw new Error(
      `SMTP relay accepted no recipients${rejected.length > 0 ? ` (rejected: ${rejected.join(", ")})` : ""}.`
    );
  }

  return { accepted, messageId: info.messageId, rejected };
}

/**
 * Opens a connection and runs the SMTP handshake without sending anything.
 * Backs the admin "test connection" affordance so a misconfigured relay is
 * found before a reporter's case is lost to it.
 */
export async function verifySmtpConnection(): Promise<void> {
  await getTransporter().verify();
}
