import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  ModelMessage,
  ToolApprovalStatus,
  ToolExecutionOptions,
  ToolSet,
} from "ai";

/**
 * Assistant tools that change data. Each one runs only after the signed-in
 * user confirms that exact call on the card the chat shows for it.
 */
export const CONFIRMED_TOOL_NAMES: ReadonlySet<string> = new Set([
  "approveRequest",
  "createContent",
  "createM365User",
  "deleteContent",
  "publishContent",
  "rejectRequest",
  "toggleFeatureFlag",
  "updateContent",
]);

/** Appended to each confirmed tool's description for the model. */
export const CONFIRMED_BY_CARD =
  "Calling this shows the user a confirmation card for this exact call, and it runs only after they confirm. Don't call confirmAction for it.";

/** How long a confirmation card stays valid after the server issues it. */
export const CONFIRMATION_TTL_MS = 10 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 60 * 1000;
const STAMP_VERSION = "confirm-v1";
const STAMP_PARTS = 3;

const NOT_CONFIRMED =
  "Not run: this change needs the user's confirmation on its card in the chat.";
const EXPIRED =
  "Not run: the confirmation expired. Ask the user to confirm again.";
const ALREADY_USED = "Not run: this confirmation was already used.";

/** Confirmations used on this server instance, kept until they expire. */
const usedOnThisInstance = new Map<string, number>();

export interface ConfirmationGateOptions {
  now?: () => number;
  /** Server-only secret; per-user keys are derived from it. */
  secret: string;
  /** Defaults to the instance-wide set. Tests pass their own. */
  usedConfirmations?: Map<string, number>;
  userId: string;
}

interface ToolCallLike {
  input: unknown;
  toolCallId: string;
  toolName: string;
}

type ConfirmationCheck = { ok: true } | { ok: false; reason: string };

export interface ConfirmationGate {
  /** Pass to `streamText` as `experimental_toolApprovalSecret`. */
  approvalSecret: string;
  /** Wraps every confirmed tool so it refuses to run without a valid confirmation. */
  guardTools: <T extends ToolSet>(tools: T) => T;
  /** Pass to `streamText` as `toolApproval`. */
  toolApproval: (options: { toolCall: ToolCallLike }) => ToolApprovalStatus;
}

/** JSON with object keys sorted, so the same input always gives the same text. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, nested: unknown) => {
    if (
      nested === null ||
      typeof nested !== "object" ||
      Array.isArray(nested)
    ) {
      return nested;
    }
    const entries = Object.entries(nested as Record<string, unknown>);
    entries.sort(([a], [b]) => {
      if (a < b) {
        return -1;
      }
      return a > b ? 1 : 0;
    });
    return Object.fromEntries(entries);
  });
}

function deriveKey(secret: string, purpose: string, userId: string): Buffer {
  return createHmac("sha256", secret)
    .update(JSON.stringify(["biso-admin-assistant", purpose, userId]))
    .digest();
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function parseStamp(
  reason: string | undefined
): { issuedAt: number; mac: string } | null {
  const parts = reason?.split(".");
  if (parts?.length !== STAMP_PARTS || parts[0] !== STAMP_VERSION) {
    return null;
  }
  const issuedAt = Number(parts[1]);
  const mac = parts[2];
  if (!(Number.isSafeInteger(issuedAt) && mac)) {
    return null;
  }
  return { issuedAt, mac };
}

/**
 * The approval request for this tool call, if the request messages also hold
 * an approved response to it.
 */
function findApprovedRequest(
  messages: ModelMessage[],
  toolCallId: string
): { reason?: string } | null {
  const approvedIds = new Set<string>();
  for (const message of messages) {
    if (message.role !== "tool") {
      continue;
    }
    for (const part of message.content) {
      if (part.type === "tool-approval-response" && part.approved) {
        approvedIds.add(part.approvalId);
      }
    }
  }
  for (const message of messages) {
    if (message.role !== "assistant" || typeof message.content === "string") {
      continue;
    }
    for (const part of message.content) {
      if (
        part.type === "tool-approval-request" &&
        part.toolCallId === toolCallId &&
        approvedIds.has(part.approvalId)
      ) {
        return part;
      }
    }
  }
  return null;
}

function pruneExpired(used: Map<string, number>, now: number) {
  for (const [mac, expiresAt] of used) {
    if (expiresAt < now) {
      used.delete(mac);
    }
  }
}

/**
 * Binds assistant writes to a click on their confirmation card: the same
 * user, the exact tool call and input, within CONFIRMATION_TTL_MS, once.
 */
export function createConfirmationGate(
  options: ConfirmationGateOptions
): ConfirmationGate {
  if (!(options.secret && options.userId)) {
    throw new Error("Assistant confirmations need a secret and a user id");
  }
  const now = options.now ?? Date.now;
  const used = options.usedConfirmations ?? usedOnThisInstance;
  const stampKey = deriveKey(
    options.secret,
    "confirmation-stamp-v1",
    options.userId
  );
  const approvalSecret = deriveKey(
    options.secret,
    "tool-approval-v1",
    options.userId
  ).toString("base64url");

  function stampMac(call: ToolCallLike, issuedAt: number): string {
    return createHmac("sha256", stampKey)
      .update(
        JSON.stringify([
          STAMP_VERSION,
          call.toolCallId,
          call.toolName,
          canonicalJson(call.input),
          issuedAt,
        ])
      )
      .digest("base64url");
  }

  function verify(
    call: ToolCallLike,
    messages: ModelMessage[]
  ): ConfirmationCheck {
    const request = findApprovedRequest(messages, call.toolCallId);
    const stamp = parseStamp(request?.reason);
    if (!(stamp && safeEqual(stampMac(call, stamp.issuedAt), stamp.mac))) {
      return { ok: false, reason: NOT_CONFIRMED };
    }
    const current = now();
    const age = current - stamp.issuedAt;
    if (age > CONFIRMATION_TTL_MS || age < -MAX_CLOCK_SKEW_MS) {
      return { ok: false, reason: EXPIRED };
    }
    pruneExpired(used, current);
    if (used.has(stamp.mac)) {
      return { ok: false, reason: ALREADY_USED };
    }
    used.set(stamp.mac, stamp.issuedAt + CONFIRMATION_TTL_MS);
    return { ok: true };
  }

  function guardTools<T extends ToolSet>(tools: T): T {
    const guarded: ToolSet = { ...tools };
    for (const [toolName, original] of Object.entries(tools)) {
      const execute = original.execute;
      if (!(CONFIRMED_TOOL_NAMES.has(toolName) && execute)) {
        continue;
      }
      guarded[toolName] = {
        ...original,
        execute: (input: unknown, execution: ToolExecutionOptions<unknown>) => {
          const check = verify(
            { input, toolCallId: execution.toolCallId, toolName },
            execution.messages
          );
          if (!check.ok) {
            return {
              confirmationRequired: true,
              error: check.reason,
              success: false,
            };
          }
          return execute(input, execution);
        },
      } as ToolSet[string];
    }
    return guarded as T;
  }

  return {
    approvalSecret,
    guardTools,
    toolApproval: ({ toolCall }) => {
      if (!CONFIRMED_TOOL_NAMES.has(toolCall.toolName)) {
        return;
      }
      const issuedAt = now();
      return {
        reason: `${STAMP_VERSION}.${issuedAt}.${stampMac(toolCall, issuedAt)}`,
        type: "user-approval",
      };
    },
  };
}
