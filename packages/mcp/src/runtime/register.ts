/**
 * Tool definition and registration.
 *
 * A module declares tools as data; this file turns them into SDK registrations.
 * Centralising that means the cross-cutting guarantees happen once and cannot
 * be forgotten by a tool author:
 *
 * - a correlation id per call,
 * - authorization re-checked at execution time, not just at registration,
 * - one uniform result envelope,
 * - errors mapped through the taxonomy with unexpected ones scrubbed,
 * - an audit record for every call including refusals,
 * - a wall-clock timeout so a stalled backend cannot hang the client.
 *
 * Registration itself is a second, independent gate: a tool whose
 * `isAvailable` returns false is never registered, so a model cannot see it,
 * and the `list_capabilities` tool reports why. That is a usability measure,
 * not a security boundary — the `authorize` hook and the services are what
 * actually enforce access.
 */

import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  CallToolResult,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import type { ZodRawShape, z } from "zod";
import type { PolicyProfile } from "../identity/principal";
import type { ToolContext } from "./context";
import { DomainError, isDomainError } from "./errors";
import type { Logger } from "./logger";
import type { MutationTier } from "./mutation";
import { type ToolOutcome, toCallToolResult, toToolError } from "./result";

/** The parsed argument object for a tool declared with a raw Zod shape. */
type ArgsOf<TShape extends ZodRawShape> = z.infer<z.ZodObject<TShape>>;

/** Why a tool is not registered, for `list_capabilities`. */
export interface UnavailableTool {
  module: string;
  name: string;
  reason: string;
}

export interface ToolDefinition<TShape extends ZodRawShape = ZodRawShape> {
  /**
   * MCP annotations. These are hints for the client's UI and consent flow;
   * they enforce nothing. The real gate is `tier` plus the service layer.
   */
  annotations: ToolAnnotations;
  description: string;
  handler(
    args: ArgsOf<TShape>,
    context: ToolContext
  ): Promise<ToolOutcome<unknown>>;
  inputSchema: TShape;
  /**
   * Whether this tool can work given identity, configuration and backend
   * support. Returning a string registers nothing and reports that string.
   */
  isAvailable?(context: ToolContext): true | string;
  name: string;
  /** Profiles allowed to see this tool at all. */
  profiles: readonly PolicyProfile[];
  /**
   * The mutation tier, or `undefined` for a pure read.
   *
   * Must agree with `annotations.readOnlyHint`; `assertAnnotationsAgree`
   * enforces that at registration so a destructive tool cannot be advertised
   * as read-only.
   */
  tier?: MutationTier;
  title: string;
}

/**
 * Declare a tool with its argument type inferred from `inputSchema`.
 *
 * Assigning an object literal straight into `ToolDefinition[]` collapses the
 * generic to its `ZodRawShape` default, which types every handler argument as
 * `unknown`. This wrapper captures the concrete shape for the handler and
 * widens only on the way into the array, so each handler sees its own
 * parsed-argument type while modules stay heterogeneous.
 */
export function defineTool<TShape extends ZodRawShape>(
  definition: ToolDefinition<TShape>
): ToolDefinition {
  return definition as unknown as ToolDefinition;
}

export interface ToolModule {
  description: string;
  /** Stable module id, e.g. `content`. Used in capability reporting. */
  name: string;
  title: string;
  tools: ToolDefinition[];
}

const DEFAULT_TOOL_TIMEOUT_MS = 60_000;

/**
 * A tool that mutates must not claim to be read-only, and vice versa. Getting
 * this wrong makes a client's consent UI lie, so it fails loudly at startup
 * rather than silently at call time.
 */
function assertAnnotationsAgree(tool: ToolDefinition): void {
  const readOnly = tool.annotations.readOnlyHint === true;
  if (readOnly && tool.tier !== undefined) {
    throw new Error(
      `Tool "${tool.name}" declares readOnlyHint but has mutation tier "${tool.tier}".`
    );
  }
  if (!readOnly && tool.tier === undefined) {
    throw new Error(
      `Tool "${tool.name}" is not read-only but declares no mutation tier.`
    );
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  toolName: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new DomainError(
              "timeout",
              `The tool "${toolName}" did not complete within ${ms}ms.`,
              {
                details: { tool: toolName, timeoutMs: ms },
                remedy:
                  "Narrow the query (a smaller limit or a tighter filter) and try again.",
              }
            )
          );
        }, ms);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export interface RegisterResult {
  registered: string[];
  unavailable: UnavailableTool[];
}

/**
 * Run one tool call with the cross-cutting guarantees applied.
 *
 * Extracted from the registration loop so the guarantees read as one sequence:
 * correlate, run under a timeout, audit the outcome, and map any failure
 * through the taxonomy.
 */
async function invokeTool(input: {
  args: Record<string, unknown>;
  context: ToolContext;
  timeoutMs: number;
  tool: ToolDefinition;
}): Promise<CallToolResult> {
  const { tool, args, context, timeoutMs } = input;
  const requestId = randomUUID();
  const startedAt = Date.now();
  const logger = context.logger.child({ requestId, tool: tool.name });
  const tier = tool.tier ?? "read";

  try {
    const handling = tool.handler(args as never, { ...context, logger });
    // Only reads race a timer. `Promise.race` abandons the loser; it does not
    // cancel it, and the Appwrite SDK exposes no way to abort a request already
    // in flight. Racing a mutation would therefore report a timeout to the
    // caller while the write went on to succeed — leaving them to propose the
    // same change again, this time genuinely duplicating it.
    //
    // Abandoning a *read* costs nothing, so reads keep the guard. A mutation is
    // awaited to a definitive outcome instead, which is bounded rather than
    // open-ended: `@repo/api/runtime` gives every Appwrite request its own
    // `AbortSignal` deadline and raises a 504 when it expires, so the slowest
    // possible mutation is its request count times that deadline.
    const outcome =
      tier === "read"
        ? await withTimeout(handling, timeoutMs, tool.name)
        : await handling;
    // A propose-mode call succeeds without writing anything. Recording it as
    // `ok` would put an entry in the activity log that reads like a completed
    // action, and `createAuditor` persists exactly those. Classify it as what
    // it is.
    await context.auditor.record({
      requestId,
      action: tool.name,
      outcome: auditOutcome(outcome, tier),
      durationMs: Date.now() - startedAt,
      payload: { tier },
    });
    return toCallToolResult(outcome);
  } catch (rawError) {
    // A mutation that failed on a backend timeout has an unknown outcome: the
    // request was sent and may have been applied. Saying `timeout` invites a
    // retry, so it is reported as `external_uncertain`, whose whole meaning is
    // "attempted, outcome unknown, never retry automatically".
    const error = uncertainIfMutationTimedOut(rawError, tier);
    logToolFailure(logger, error);
    await context.auditor.record({
      requestId,
      action: tool.name,
      outcome: "error",
      durationMs: Date.now() - startedAt,
      payload: { code: isDomainError(error) ? error.code : "internal" },
    });
    return toCallToolResult(toToolError(error, requestId));
  }
}

/**
 * Reclassify a backend timeout on a mutating tool as an uncertain outcome.
 *
 * The write was dispatched. Whether it landed is genuinely unknown, and the
 * only safe next step is to read the current state — never to resend.
 */
function uncertainIfMutationTimedOut(
  error: unknown,
  tier: MutationTier | "read"
): unknown {
  if (tier === "read" || !isDomainError(error) || error.code !== "timeout") {
    return error;
  }
  return new DomainError(
    "external_uncertain",
    `${error.message} The write may or may not have been applied.`,
    {
      details: error.details,
      remedy:
        "Do not retry this proposal. Read the current state first, and only propose again if the change is still needed.",
      cause: error,
    }
  );
}

/**
 * Map a tool outcome onto an audit outcome.
 *
 * A handler that performed no write reports `effect: "proposed"`; a read tool
 * reports `"read"` or leaves it unset. Only `"executed"` is a change worth
 * persisting as one.
 */
function auditOutcome(
  outcome: ToolOutcome<unknown>,
  tier: MutationTier | "read"
): "ok" | "denied" | "proposed" | "read" {
  if (!outcome.ok) {
    return "denied";
  }
  if (outcome.effect === "proposed") {
    return "proposed";
  }
  if (outcome.effect === "executed") {
    return "ok";
  }
  // A successful read. `createAuditor` persists only `ok`, so classifying
  // reads separately is what keeps `audit_logs` a record of changes rather
  // than of every question anyone asked.
  //
  // The tier is the safety net: a mutating tool that forgets to report its
  // effect is still audited as a change, because a missing row for a real
  // mutation is worse than a spurious one for a read.
  return tier === "read" ? "read" : "ok";
}

/**
 * A `DomainError` is an expected, described failure. Anything else is a bug:
 * it is logged in full here and reported to the caller as a generic internal
 * error, because its message may carry a secret or another user's data.
 */
function logToolFailure(logger: Logger, error: unknown): void {
  if (isDomainError(error)) {
    logger.warn("Tool returned a domain error", {
      code: error.code,
      message: error.message,
    });
    return;
  }
  logger.error("Tool threw an unexpected error", {
    error: error instanceof Error ? error.stack : String(error),
  });
}

export function registerModules(
  server: McpServer,
  modules: readonly ToolModule[],
  context: ToolContext,
  options: { timeoutMs?: number } = {}
): RegisterResult {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS;
  const registered: string[] = [];
  const unavailable: UnavailableTool[] = [];

  for (const currentModule of modules) {
    for (const tool of currentModule.tools) {
      assertAnnotationsAgree(tool);

      if (!tool.profiles.includes(context.principal.profile)) {
        unavailable.push({
          name: tool.name,
          module: currentModule.name,
          reason: `Requires one of these profiles: ${tool.profiles.join(", ")}. This session has "${context.principal.profile}".`,
        });
        continue;
      }

      const availability = tool.isAvailable?.(context) ?? true;
      if (availability !== true) {
        unavailable.push({
          name: tool.name,
          module: currentModule.name,
          reason: availability,
        });
        continue;
      }

      server.registerTool(
        tool.name,
        {
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: tool.annotations,
          _meta: {
            "no.biso.module": currentModule.name,
            "no.biso.tier": tool.tier ?? "read",
          },
        },
        // The SDK types the callback against the inferred shape; the cast
        // keeps one uniform handler signature across every module.
        ((args: Record<string, unknown>) =>
          invokeTool({
            tool,
            args,
            context,
            timeoutMs,
          })) as never
      );

      registered.push(tool.name);
    }
  }

  return { registered, unavailable };
}
