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
 * and the `list_capabilities` tool reports why. That much is a usability
 * measure — the services are what enforce access to rows.
 *
 * The profile gate is not, though, and cannot be. Registration is a snapshot
 * of the memberships this process saw at startup, and a stdio server outlives
 * that snapshot; a tool gated on `profiles` alone (the platform module, whose
 * handler takes no principal) would otherwise stay callable for the rest of
 * the session after the membership behind it is revoked. So the profile is
 * re-checked against the refreshed principal on every call, here.
 */

import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  CallToolResult,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import type { ZodRawShape, z } from "zod";
import {
  isAnonymous,
  type PolicyProfile,
  type Principal,
} from "../identity/principal";
import type { MutationNote, ToolContext } from "./context";
import { DomainError, forbidden, isDomainError } from "./errors";
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
  /**
   * Why this read does *not* need a forced principal refresh.
   *
   * The default is inverted deliberately. A read is exempt only when the
   * backend applies the caller's own credential to it — and on this schema
   * that is rarer than it looks: `events`, `news`, `jobs`, `documents`,
   * `pages`, `page_translations`, `content_translations`, `campus_benefits`
   * and `webshop_products` all carry a table-level `read("any")` (roadmap S1),
   * so Appwrite returns their rows to anyone and this package's scope check is
   * the only boundary. Reads through `requireElevated` have the same property
   * for the same reason, and a handler that takes no principal has no check at
   * all beyond `profiles`.
   *
   * So every staff-only read is treated like a mutation: memberships are
   * re-resolved before it, and a refresh that cannot confirm them refuses
   * rather than serving from cache. Tools available to the `public` profile
   * are exempt without saying so — they answer as a signed-out visitor, where
   * there is nothing to revoke.
   *
   * Setting this is a claim that neither applies. It takes the reason rather
   * than a boolean so the claim has to be argued at the call site.
   */
  unprivilegedRead?: string;
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
 * Whether this call must re-resolve memberships before it runs.
 *
 * Mutations always must. Reads must unless they are exempt — see
 * `ToolDefinition.unprivilegedRead` for what exemption means and why it is the
 * minority case on this schema.
 *
 * The exemption is a property of the *caller*, not of the tool's audience.
 * This used to read `!tool.profiles.includes("public")`, which exempted every
 * tool a signed-out visitor may also call — and `biso_whoami`,
 * `biso_list_capabilities` and `biso_explain_permission` are exactly that:
 * open to everyone, and entirely about the caller's own authority. An
 * authenticated caller therefore heard their revoked roles read back from
 * cache for the whole TTL, while the mutation tools forced a refresh and
 * refused the same authority in the same session. A tool being available to
 * the public says nothing about whether *this* caller's memberships matter.
 *
 * An anonymous caller has no memberships that can go stale, so they are the
 * one group a read can skip it for.
 */
function needsCurrentMemberships(
  tool: ToolDefinition,
  principal: Principal
): boolean {
  if ((tool.tier ?? "read") !== "read") {
    return true;
  }
  if (tool.unprivilegedRead) {
    return false;
  }
  return !isAnonymous(principal);
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
  // Monotonic, for the same reason `@repo/api/runtime` uses it: this duration
  // is persisted to `audit_logs`, and a wall-clock step mid-call would record
  // a wrong — possibly negative — elapsed time.
  const startedAt = performance.now();
  const logger = context.logger.child({ requestId, tool: tool.name });
  const tier = tool.tier ?? "read";
  // Per call, never shared: this holder is closed over by this invocation
  // alone, so one tool's targets can never land on another's audit row. A
  // holder rather than a bare `let` because the only writer is the callback
  // below, and TypeScript would otherwise narrow the variable to `null` at
  // every read that follows.
  const mutation: { note: MutationNote | null } = { note: null };

  try {
    // Authorize against current memberships, not the ones this process saw at
    // startup. Forced for anything that mutates — those execute through the
    // service-key client, so this check is the only place a revoked role can
    // still be caught — and for every staff read, which mostly shares that
    // property. See `unprivilegedRead` for why the default runs that way.
    const principal = await context.refreshPrincipal({
      force: needsCurrentMemberships(tool, context.principal),
    });
    // Registration filtered the tool list against the profile this process
    // resolved at startup, and the SDK keeps a tool callable for the life of
    // the connection once it is registered. A stdio server outlives that
    // snapshot by hours, so the profile has to be re-checked here too.
    //
    // This is not redundant with the service layer: a tool whose only gate is
    // `profiles` has no second check to fall back on. `biso_integration_
    // configuration` is exactly that — its handler takes no principal, because
    // registration was assumed to be the gate — so without this it keeps
    // reporting which integrations this process has configured for the whole
    // session after the global-admin membership behind it is revoked.
    assertProfileAllowed(tool, principal);
    const handling = tool.handler(args as never, {
      ...context,
      principal,
      logger,
      noteMutation: (value) => {
        mutation.note = value;
      },
    });
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
      ...auditSubject(mutation.note, tool.name),
      outcome: auditOutcome(outcome, tier),
      durationMs: Math.round(performance.now() - startedAt),
      payload: { tier, tool: tool.name, targets: mutation.note?.targets },
    });
    // The id the caller is given must be the id the caller can look up.
    //
    // Handlers mint their own with `newRequestId()` so a result is
    // self-describing when a service is exercised directly in a test — but
    // this dispatcher's id is the one bound into the child logger above and
    // written to the audit row just now, and it is the one `toToolError`
    // already returns on the failure path. Returning the handler's id on
    // success meant the *successful* mutation — the one whose audit row
    // someone actually wants to find — was the one case whose `requestId`
    // matched nothing in the log or in `audit_logs`.
    return toCallToolResult(withRequestId(outcome, requestId));
  } catch (rawError) {
    // A timeout is NOT reclassified here. A mutating handler reads before it
    // writes, and in propose mode it never writes at all, so the tool's tier
    // cannot tell "the write may have landed" from "a lookup timed out". Only
    // `proposeOrExecute` knows a write was dispatched, and it does the
    // reclassification at that point.
    logToolFailure(logger, rawError);
    await context.auditor.record({
      requestId,
      ...auditSubject(mutation.note, tool.name),
      outcome: "error",
      durationMs: Math.round(performance.now() - startedAt),
      payload: {
        code: isDomainError(rawError) ? rawError.code : "internal",
        tool: tool.name,
      },
    });
    return toCallToolResult(toToolError(rawError, requestId));
  }
}

/**
 * Stamp the dispatcher's request id onto a successful outcome.
 *
 * Only the envelope's own id is replaced; nothing inside `data` is touched, so
 * a proposal token or a row id that happens to be a UUID is left alone.
 */
function withRequestId(
  outcome: ToolOutcome<unknown>,
  requestId: string
): ToolOutcome<unknown> {
  return outcome.ok === true ? { ...outcome, requestId } : outcome;
}

/**
 * Refuse a call whose profile no longer allows the tool.
 *
 * Phrased as a change ("now resolves as") rather than a flat denial, because
 * the model *can* see the tool: it is in the list the client fetched at
 * connect time. Telling it the session's profile changed is what stops it
 * retrying a tool it can still see.
 */
function assertProfileAllowed(
  tool: ToolDefinition,
  principal: Principal
): void {
  if (tool.profiles.includes(principal.profile)) {
    return;
  }
  throw forbidden(
    `"${tool.name}" requires one of these profiles: ${tool.profiles.join(", ")}. This session now resolves as "${principal.profile}".`,
    {
      tool: tool.name,
      requiredProfiles: [...tool.profiles],
      currentProfile: principal.profile,
    },
    "Reconnect to refresh the tool list; this tool is no longer available to this identity."
  );
}

/**
 * Map a tool outcome onto an audit outcome.
 *
 * A handler that performed no write reports `effect: "proposed"`; a read tool
 * reports `"read"` or leaves it unset. Only `"executed"` is a change worth
 * persisting as one.
 */
/**
 * What the audit row is *about*.
 *
 * A mutation names its dotted action and its primary row — the shape
 * `logAuditEvent` writes from the portal (`page_unpublished`, resource id,
 * resource type), so an MCP change and a portal change line up in the same
 * activity log instead of one of them reading as a bare tool name. Without
 * this, publishing one page and unpublishing another produced two identical
 * rows.
 *
 * `audit_logs` carries one `resource_id`/`resource_type` pair while a change
 * can touch several rows, so the first target is the subject and the whole
 * list travels in the payload. Anything that reported no note — every read,
 * and any failure raised before the proposal gate — falls back to the tool's
 * name, which is then genuinely all that is known about it.
 */
function auditSubject(
  note: MutationNote | null,
  toolName: string
): { action: string; resourceId?: string; resourceType?: string } {
  if (!note) {
    return { action: toolName };
  }
  const primary = note.targets[0];
  return {
    action: note.action,
    resourceId: primary?.id,
    resourceType: primary?.table,
  };
}

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
