import { resolveTargets } from "./resolve";
import { type SyncDeps, syncTargets } from "./sync";
import { classifyTrigger } from "./trigger";

export interface RequestLike {
  bodyJson?: unknown;
  bodyText?: string;
  headers?: Record<string, string | undefined>;
}

export interface HandlerResult {
  body: unknown;
  status: number;
}

export interface HandlerInput {
  deps: SyncDeps;
  /** The full reindex, run by a secret-guarded HTTP call. */
  reindex: () => Promise<Record<string, unknown>>;
  req: RequestLike;
  secret: string | undefined;
}

const OK_STATUS = 200;
const FAILED_STATUS = 500;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * The row JSON of an event execution, or null. The runtime's `bodyJson`
 * getter throws on an empty body, so parse `bodyText` first and touch
 * `bodyJson` only inside a try/catch.
 */
export function readEventBody(
  req: RequestLike
): Record<string, unknown> | null {
  try {
    if (req.bodyText) {
      return asRecord(JSON.parse(req.bodyText));
    }
  } catch {
    return null;
  }
  try {
    return asRecord(req.bodyJson);
  } catch {
    return null;
  }
}

async function route(input: HandlerInput): Promise<HandlerResult> {
  const { deps, req, secret } = input;
  const headers = req.headers ?? {};
  // Only events carry a row; the reindex call sends no body.
  const body =
    headers["x-appwrite-trigger"] === "event" ? readEventBody(req) : null;
  const trigger = classifyTrigger(headers, secret, body);

  if (trigger.kind === "reject") {
    return {
      body: { error: trigger.reason, ok: false },
      status: trigger.status,
    };
  }
  if (trigger.kind === "reindex") {
    return { body: await input.reindex(), status: OK_STATUS };
  }

  const resolution = resolveTargets(trigger);
  if (resolution.kind === "ignored") {
    // 200, not 4xx: a table or translation type we do not index is expected
    // traffic and must not reach Sentry.
    deps.log(`${trigger.table} ${trigger.id}: ignored (${resolution.reason})`);
    return {
      body: { ignored: resolution.reason, ok: true },
      status: OK_STATUS,
    };
  }
  const counts = await syncTargets(deps, resolution.targets);
  return { body: { ok: true, ...counts }, status: OK_STATUS };
}

/**
 * Route one execution: a row event, the reindex, or a rejection. A failed
 * Appwrite read or Meilisearch write answers 500 with its message.
 */
export async function handleRequest(
  input: HandlerInput
): Promise<HandlerResult> {
  try {
    return await route(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { body: { error: message, ok: false }, status: FAILED_STATUS };
  }
}
