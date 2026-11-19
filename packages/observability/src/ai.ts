import {
  SPAN_STATUS_ERROR,
  type Span,
  type SpanAttributes,
  type SpanStatus,
  startInactiveSpan,
  startSpan,
  withActiveSpan,
} from "@sentry/core";
import { describeError } from "./scrub";

/**
 * Spans for model calls, per Sentry's AI request span: op
 * `gen_ai.<operation>`, name `<operation> <model>`, and `gen_ai.*` attributes
 * for the model, provider, feature and token counts. They never carry prompts,
 * messages, tool arguments or output.
 */

/** The feature that makes the call. Never user data. */
export type AiFunctionId =
  | "admin.job-description"
  | "admin.event-description"
  | "admin.recruitment-comparison"
  | "admin.recruitment-assistant"
  | "admin.page-editor-chat"
  | "admin.assistant"
  | "admin.content-translation"
  | "docs.ask"
  | "api.expense-summary"
  | "api.expense-account"
  | "api.expense-approver"
  | "api.receipt-extract"
  | "api.receipt-classify"
  | "ai.assistant-content-tool"
  | "ai.recruitment-email"
  | "ai.recruitment-screening"
  | "ai.department-resolver";

/** A model id, or the AI SDK model object passed to the call. */
export type AiModel =
  | string
  | { readonly modelId: string; readonly provider: string };

export interface AiCallMeta {
  functionId: AiFunctionId;
  model: AiModel;
  /** `generate_object` for `generateObject`, `chat` for `streamText`. */
  operation: "generate_object" | "chat";
}

/** The AI SDK's token usage, as far as the span reads it. */
export interface AiUsage {
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
}

/**
 * Sentry's operation names for a model call (`chat`, `embeddings`,
 * `generate_content`, `text_completion`). Its own Vercel AI integration names
 * every model call `generate_content`; a stream is a chat.
 */
const OPERATION_NAMES = {
  chat: "chat",
  generate_object: "generate_content",
} as const;

const FAILED: SpanStatus = {
  code: SPAN_STATUS_ERROR,
  message: "internal_error",
};

/** The client went away, or the call was aborted for another reason. */
const CANCELLED: SpanStatus = { code: SPAN_STATUS_ERROR, message: "cancelled" };

/** A timeout aborted the call. */
const DEADLINE_EXCEEDED: SpanStatus = {
  code: SPAN_STATUS_ERROR,
  message: "deadline_exceeded",
};

const modelId = (model: AiModel): string =>
  typeof model === "string" ? model : model.modelId;

/** `anthropic.messages` → `anthropic`. An id string names no provider. */
const providerName = (model: AiModel): string | undefined =>
  typeof model === "string" ? undefined : model.provider.split(".")[0];

const spanOptions = (meta: AiCallMeta, attributes: SpanAttributes = {}) => {
  const operation = OPERATION_NAMES[meta.operation];
  const model = modelId(meta.model);
  const provider = providerName(meta.model);
  return {
    attributes: {
      ...attributes,
      "gen_ai.operation.name": operation,
      "gen_ai.pipeline.name": meta.functionId,
      "gen_ai.request.model": model,
      ...(provider ? { "gen_ai.provider.name": provider } : {}),
    },
    name: `${operation} ${model}`,
    op: `gen_ai.${operation}`,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const tokenCount = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;

/** Token counts and the responding model id. Reads nothing else. */
const recordResult = (span: Span, result: unknown): void => {
  try {
    if (!isRecord(result)) {
      return;
    }
    const usage = isRecord(result.usage) ? result.usage : {};
    const input = tokenCount(usage.inputTokens);
    const output = tokenCount(usage.outputTokens);
    const attributes: SpanAttributes = {};
    if (input !== undefined) {
      attributes["gen_ai.usage.input_tokens"] = input;
    }
    if (output !== undefined) {
      attributes["gen_ai.usage.output_tokens"] = output;
    }
    if (input !== undefined && output !== undefined) {
      attributes["gen_ai.usage.total_tokens"] = input + output;
    }
    const response = isRecord(result.response) ? result.response : {};
    if (typeof response.modelId === "string") {
      attributes["gen_ai.response.model"] = response.modelId;
    }
    span.setAttributes(attributes);
  } catch {
    // Telemetry must never affect the call.
  }
};

/** Error status and the error's class name, never its message. */
const recordFailure = (span: Span, error: unknown): void => {
  try {
    span.setStatus(FAILED);
    span.setAttribute(
      "error.type",
      error instanceof Error ? error.name : "Error"
    );
  } catch {
    // Telemetry must never affect the call.
  }
};

/**
 * `AbortSignal.timeout()`, and the AI SDK's own `timeout` option, abort with a
 * `TimeoutError`.
 */
const isTimeout = (reason: unknown): boolean =>
  isRecord(reason) && reason.name === "TimeoutError";

/**
 * An aborted call ends as cancelled, or as timed out. Sentry sends a
 * `cancelled` span as `ok`, so the reason is also kept as an attribute.
 */
const recordAbort = (span: Span, reason: unknown): void => {
  try {
    const status = isTimeout(reason) ? DEADLINE_EXCEEDED : CANCELLED;
    span.setStatus(status);
    span.setAttribute("sentry.cancellation_reason", status.message);
  } catch {
    // Telemetry must never affect the call.
  }
};

/**
 * What the AI SDK's default `onError` would log, minus what it shouldn't: the
 * error's class (and a scrubbed message unless it is an AI SDK error, whose
 * message can quote model output), plus a failed provider call's HTTP status.
 */
const logStreamError = (functionId: AiFunctionId, error: unknown): void => {
  try {
    const status =
      isRecord(error) && typeof error.statusCode === "number"
        ? ` (HTTP ${error.statusCode})`
        : "";
    console.error(
      `[ai] ${functionId} stream failed:`,
      `${describeError(error)}${status}`
    );
  } catch {
    // Telemetry must never affect the call.
  }
};

/**
 * Wraps one `generateObject` call in an AI request span. Returns the call's
 * result and rethrows its error unchanged.
 */
export const traceAiCall = <T extends { usage?: AiUsage }>(
  meta: AiCallMeta,
  run: () => Promise<T>
): Promise<T> =>
  startSpan(spanOptions(meta), async (span) => {
    try {
      const result = await run();
      recordResult(span, result);
      return result;
    } catch (error) {
      recordFailure(span, error);
      throw error;
    }
  });

export interface AiStreamCallbacks {
  /**
   * Pass as `streamText({ onAbort })`. A timeout ends the span as
   * `deadline_exceeded`, any other abort as `cancelled`.
   */
  onAbort: (event?: { reason?: unknown }) => void;
  /** Pass as `streamText({ onEnd })`, or call it from an existing one. */
  onEnd: (event: { usage?: AiUsage }) => void;
  /** Call from `streamText({ onError })`. Logs nothing. */
  onError: (event: { error: unknown }) => void;
  /**
   * Pass as `streamText({ onError })` to keep a log line: like `onError`, and
   * logs the error's class, never the error object (AI SDK errors carry the
   * model's output).
   */
  onErrorWithLog: (event: { error: unknown }) => void;
}

export interface AiStreamMeta extends AiCallMeta {
  /**
   * The request's signal. The AI SDK calls no callback when the client goes
   * away mid-stream, so this ends the span then, as cancelled.
   */
  signal?: AbortSignal;
}

/**
 * Wraps one `streamText` call in an AI request span that stays open until the
 * stream ends, fails, is aborted or the request goes away, and ends once.
 * `start` makes the call with the callbacks it is given and returns its result.
 */
export const traceAiStream = <R>(
  meta: AiStreamMeta,
  start: (callbacks: AiStreamCallbacks) => R
): R => {
  const span = startInactiveSpan(
    spanOptions(meta, { "gen_ai.response.streaming": true })
  );
  let ended = false;
  const end = (record?: () => void): void => {
    if (ended) {
      return;
    }
    ended = true;
    meta.signal?.removeEventListener("abort", onRequestGone);
    record?.();
    span.end();
  };
  const onRequestGone = (): void =>
    end(() => recordAbort(span, meta.signal?.reason));
  const onError = (event: { error: unknown }): void =>
    end(() => recordFailure(span, event.error));

  const callbacks: AiStreamCallbacks = {
    onAbort: (event) => end(() => recordAbort(span, event?.reason)),
    onEnd: (event) => end(() => recordResult(span, event)),
    onError,
    onErrorWithLog: (event) => {
      onError(event);
      logStreamError(meta.functionId, event.error);
    },
  };

  if (meta.signal?.aborted) {
    onRequestGone();
  } else {
    meta.signal?.addEventListener("abort", onRequestGone, { once: true });
  }

  try {
    return withActiveSpan(span, () => start(callbacks));
  } catch (error) {
    callbacks.onError({ error });
    throw error;
  }
};
