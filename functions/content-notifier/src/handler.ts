import { dispatchDue, handleContentChange, type NotifierDeps } from "./run";
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
  deps: NotifierDeps;
  /** Whether another dispatch execution is in flight; given this execution's id. */
  isDispatchRunning: (selfId: string | undefined) => Promise<boolean>;
  now: Date;
  req: RequestLike;
  secret: string | undefined;
}

const OK_STATUS = 200;

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

/** Route one execution: a content event, a dispatch pass, or a rejection. */
export async function handleRequest(
  input: HandlerInput
): Promise<HandlerResult> {
  const { deps, now, req, secret } = input;
  const headers = req.headers ?? {};
  // Only events carry a body; pings and schedule runs send none.
  const body =
    headers["x-appwrite-trigger"] === "event" ? readEventBody(req) : null;
  const trigger = classifyTrigger(headers, secret, body);

  if (trigger.kind === "reject") {
    return {
      body: { error: trigger.reason, ok: false },
      status: trigger.status,
    };
  }
  if (trigger.kind === "content") {
    const result = await handleContentChange(
      deps,
      trigger.type,
      trigger.id,
      now
    );
    deps.log(`${trigger.type} ${trigger.id}: ${result}`);
    return { body: { result }, status: OK_STATUS };
  }

  if (await input.isDispatchRunning(headers["x-appwrite-execution-id"])) {
    deps.log("another dispatch is running; skipping");
    return {
      body: { ok: true, skipped: "already-running" },
      status: OK_STATUS,
    };
  }
  const result = await dispatchDue(deps, now);
  deps.log(`dispatched ${JSON.stringify(result)}`);
  return { body: result, status: OK_STATUS };
}
