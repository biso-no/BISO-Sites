import { timingSafeEqual } from "node:crypto";
import {
  contentTypeForTable,
  type NotifyContentType,
} from "@repo/shared/utils/content-notifications";

export type Trigger =
  | { id: string; kind: "content"; type: NotifyContentType }
  | { kind: "dispatch" }
  | { kind: "reject"; reason: string; status: number };

const BEARER_PREFIX = "Bearer ";
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_SERVER_ERROR = 500;
const WILDCARD = "*";
/** `tablesdb.<database>.tables.<table>.rows.<row>.<action>` */
const EVENT_PARTS = 7;
const CONTENT_ACTIONS = new Set(["create", "update", "upsert", "delete"]);

function reject(status: number, reason: string): Trigger {
  return { kind: "reject", reason, status };
}

/** Constant-time compare; only the secret's length is observable. */
function safeSecretCompare(
  candidate: string | undefined,
  secret: string
): boolean {
  if (!candidate) {
    return false;
  }
  const a = Buffer.from(candidate);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

function bodyString(
  body: Record<string, unknown> | null | undefined,
  key: string
): string | undefined {
  const value = body?.[key];
  return typeof value === "string" && value ? value : undefined;
}

function classifyEvent(
  eventName: string | undefined,
  body: Record<string, unknown> | null | undefined
): Trigger {
  const parts = eventName?.split(".") ?? [];
  const [root, , tablesKey, headerTable, rowsKey, headerId, action] = parts;
  // `tablesdb` databases emit tables/rows; legacy ones emit the same shape
  // under `databases`, or collections/documents.
  const knownShape =
    (root === "tablesdb" || root === "databases") &&
    tablesKey === "tables" &&
    rowsKey === "rows";
  const legacyShape =
    root === "databases" &&
    tablesKey === "collections" &&
    rowsKey === "documents";
  if (parts.length !== EVENT_PARTS || !(knownShape || legacyShape)) {
    return reject(
      HTTP_BAD_REQUEST,
      `Unsupported event: ${eventName ?? "none"}`
    );
  }
  if (!(action && CONTENT_ACTIONS.has(action))) {
    return reject(HTTP_BAD_REQUEST, `Unsupported event action: ${action}`);
  }

  // The header may carry the concrete event or a `*` pattern; use the body then.
  const table =
    headerTable === WILDCARD ? bodyString(body, "$tableId") : headerTable;
  const id = headerId === WILDCARD ? bodyString(body, "$id") : headerId;
  const type = table ? contentTypeForTable(table) : null;
  if (!(type && id)) {
    return reject(
      HTTP_BAD_REQUEST,
      `Not a notifiable content event: ${eventName}`
    );
  }
  return { id, kind: "content", type };
}

function classifyHttp(
  headers: Record<string, string | undefined>,
  secret: string | undefined
): Trigger {
  if (!secret) {
    return reject(HTTP_SERVER_ERROR, "CRON_SECRET is not configured");
  }
  const auth = headers.authorization;
  const bearer = auth?.startsWith(BEARER_PREFIX)
    ? auth.slice(BEARER_PREFIX.length)
    : undefined;
  const presented = headers["x-cron-secret"] ?? bearer;
  return safeSecretCompare(presented, secret)
    ? { kind: "dispatch" }
    : reject(HTTP_UNAUTHORIZED, "Unauthorized");
}

/**
 * Decide what an execution is for. Events carry one content row; schedule and
 * secret-guarded HTTP pings run the dispatch pass.
 */
export function classifyTrigger(
  headers: Record<string, string | undefined>,
  secret: string | undefined,
  body?: Record<string, unknown> | null
): Trigger {
  const trigger = headers["x-appwrite-trigger"];
  if (trigger === "event") {
    return classifyEvent(headers["x-appwrite-event"], body);
  }
  if (trigger === "schedule") {
    return { kind: "dispatch" };
  }
  if (trigger === "http") {
    return classifyHttp(headers, secret);
  }
  return reject(HTTP_BAD_REQUEST, `Unknown trigger: ${trigger ?? "none"}`);
}
