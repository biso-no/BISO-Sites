/**
 * Mutation authorization.
 *
 * Three things are routinely conflated and are kept apart here:
 *
 * 1. **Authorization** — may this principal perform this operation on this row?
 *    Decided from verified team memberships (`identity/scope.ts`). Never from a
 *    tool argument.
 * 2. **Human confirmation** — has a person agreed to this specific change?
 *    Only an MCP host elicitation answers this. A model writing
 *    `confirmed: true`, or calling a `confirm_action` tool first, proves
 *    nothing: both are the model's own output.
 * 3. **Business approval** — does this organisation require someone else to
 *    sign off? Answered by a persisted `approval_requests` row, which the
 *    admin app already implements and executes.
 *
 * A mutation runs only when all three that apply to it are satisfied.
 *
 * ## Proposals
 *
 * Every mutating tool first produces a `MutationProposal`: the resolved target,
 * the validated payload, a diff, and the revision it was computed against. In
 * `propose` mode that is the whole result. In `confirm`/`operator` mode it is
 * also what gets executed, and the token binds the execution to it — an actor,
 * an action, a payload hash, a revision and an expiry. A proposal for one
 * change can never authorize a different one.
 */

import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { WriteMode } from "../config/env";
import type { Principal } from "../identity/principal";
import { DomainError, requiresAuthorization } from "./errors";

/**
 * How reversible an operation is, and therefore what may authorize it.
 *
 * - `read` — no mutation.
 * - `draft` — creates or edits unpublished content. Reversible by editing
 *   again; nothing leaves the organisation.
 * - `publish` — changes what the public sees. Reversible by unpublishing, but
 *   visible in the meantime.
 * - `restricted` — money, outbound messages, identity changes, ledger
 *   postings. Not reversible by this package, and in several cases not
 *   reversible at all. **No write mode enables this tier.**
 */
export type MutationTier = "draft" | "publish" | "restricted";

export const MUTATION_TIERS: Record<
  MutationTier,
  { label: string; note: string }
> = {
  draft: {
    label: "Draft",
    note: "Creates or edits unpublished content. Reversible by editing again.",
  },
  publish: {
    label: "Publish",
    note: "Changes what the public sees. Reversible by unpublishing.",
  },
  restricted: {
    label: "Restricted",
    note: "Money, outbound messages, identity changes or ledger postings. This package never executes these; it can only prepare a proposal.",
  },
};

export interface MutationProposal<TPayload = unknown> {
  /** Dotted operation name, e.g. `pages.save_draft`. */
  action: string;
  /** Field-level before/after, where a before exists. */
  diff: Array<{ path: string; before: unknown; after: unknown }>;
  /**
   * What still has to happen before this executes.
   *
   * Named `execution` rather than `authorization` for the same reason — a key
   * named `authorization` is assumed to be a credential and is redacted.
   */
  execution: {
    mode: WriteMode;
    /** True when the server would execute this on a matching token. */
    executable: boolean;
    reason: string;
  };
  /** ISO timestamp after which the token is refused. */
  expiresAt: string;
  /** The exact payload that would be written, after validation. */
  payload: TPayload;
  /** Stable id for this proposal, for the caller to correlate against. */
  proposalId: string;
  /**
   * Binds actor + action + payload + revision. Opaque to the caller.
   *
   * Named to match the tool argument it is passed back as, and deliberately
   * NOT `token`: `redactSecrets` drops any key named `token` on its way out of
   * the process, which would blank the one field the caller has to echo back.
   */
  proposalToken: string;
  /**
   * The revision the proposal was computed against (an Appwrite `$updatedAt`).
   * Execution re-reads and refuses if it moved.
   */
  revision: string | null;
  /** The rows this would touch. Always concrete ids, never a filter. */
  targets: Array<{ table: string; id: string; label?: string }>;
  tier: MutationTier;
}

/**
 * A proposal that has already been applied.
 *
 * Structurally a `MutationProposal` minus `proposalToken`, and that omission is
 * the whole point. `proposeOrExecute` rebuilds the proposal on the execute path
 * so the token binds to the *current* call's own action, actor, payload and
 * revision — but rebuilding also mints a fresh expiry, and therefore a fresh
 * token the registry has never seen. Returning that token alongside the result
 * would hand every caller a second, unspent authorization for the change they
 * just made, undoing the single-use rule in `ProposalRegistry`. For an additive
 * action — `createDraft` and `requestApproval` both mint `ID.unique()` and
 * propose against a null revision, so nothing downstream would reject the
 * repeat — echoing it back writes a second row.
 *
 * Everything that describes what was applied survives; the one field that could
 * apply it again does not.
 */
export type AppliedProposal<TPayload = unknown> = Omit<
  MutationProposal<TPayload>,
  "proposalToken"
>;

/**
 * Describe a proposal that has just been executed.
 *
 * `expiresAt` is carried over from the token that actually authorized the
 * write, not from the rebuilt proposal, so the record names the proposal that
 * was spent. Without the token it authorizes nothing either way.
 *
 * Written out field by field rather than by rest-destructuring so that a new
 * field on `MutationProposal` is a type error here — the next credential-ish
 * field must be an explicit decision, not an accident of spreading.
 */
export function asApplied<TPayload>(
  proposal: MutationProposal<TPayload>,
  consumed: { expiresAt: string }
): AppliedProposal<TPayload> {
  return {
    action: proposal.action,
    diff: proposal.diff,
    execution: proposal.execution,
    expiresAt: consumed.expiresAt,
    payload: proposal.payload,
    proposalId: proposal.proposalId,
    revision: proposal.revision,
    targets: proposal.targets,
    tier: proposal.tier,
  };
}

const PROPOSAL_TTL_MS = 10 * 60 * 1000;

function hashPayload(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
}

/**
 * Derive the binding token.
 *
 * Includes the actor, so a proposal built for one user cannot be replayed by
 * another; the payload hash, so the payload cannot be swapped after the diff
 * was shown; and the revision, so a proposal cannot be applied to a document
 * that has since changed.
 *
 * `serverSecret` is per-process and never leaves it, which also means proposals
 * do not survive a restart — deliberate: a proposal describes a change the user
 * was just shown, not a durable grant.
 */
export function buildProposalToken(input: {
  serverSecret: string;
  actorId: string;
  action: string;
  payload: unknown;
  revision: string | null;
  expiresAt: string;
}): string {
  return createHash("sha256")
    .update(
      [
        input.serverSecret,
        input.actorId,
        input.action,
        hashPayload(input.payload),
        input.revision ?? "",
        input.expiresAt,
      ].join("\u0000")
    )
    .digest("base64url");
}

export interface MutationGateOptions {
  /**
   * Whether the connected client advertises `elicitation`, read at call time.
   *
   * A function rather than a flag on purpose. Client capabilities do not exist
   * until the client's `initialize` request arrives, which is *after*
   * `Server.connect()` resolves — the SDK assigns them in its `_oninitialize`
   * handler. Sampling once at connect time therefore captures `undefined` and
   * pins this to `false` forever, which silently turns `confirm` mode into
   * `propose` mode for clients that can in fact confirm.
   */
  clientSupportsElicitation(): boolean;
  /**
   * Tokens already spent. A proposal authorizes one execution attempt; see
   * `createProposalRegistry`.
   */
  proposals: ProposalRegistry;
  serverSecret: string;
  writeMode: WriteMode;
}

/**
 * Decide whether a tier can execute at all under the current configuration.
 *
 * Note `restricted` is absent from every branch on purpose.
 */
export function tierIsExecutable(
  tier: MutationTier,
  options: MutationGateOptions
): { executable: boolean; reason: string } {
  if (tier === "restricted") {
    return {
      executable: false,
      reason:
        "Restricted operations (payments, refunds, ledger postings, outbound messages, identity changes) are never executed by this server. Use the admin app, or route the change through an approval record.",
    };
  }
  if (options.writeMode === "propose") {
    return {
      executable: false,
      reason:
        "The server is running in propose mode. Set BISO_MCP_WRITE_MODE=confirm (with an elicitation-capable client) or =operator to allow execution.",
    };
  }
  if (options.writeMode === "confirm") {
    if (!options.clientSupportsElicitation()) {
      return {
        executable: false,
        reason:
          "Write mode is `confirm`, but this MCP client does not support elicitation, so the server cannot obtain human confirmation. The proposal is returned unexecuted.",
      };
    }
    return {
      executable: true,
      reason: "Executes after the user accepts the confirmation prompt.",
    };
  }
  return {
    executable: true,
    reason:
      "Operator mode: the person running this server has authorized it to apply reversible changes on their behalf.",
  };
}

export function createProposal<TPayload>(input: {
  action: string;
  tier: MutationTier;
  targets: MutationProposal["targets"];
  payload: TPayload;
  diff?: MutationProposal["diff"];
  revision?: string | null;
  principal: Principal;
  options: MutationGateOptions;
  now?: Date;
}): MutationProposal<TPayload> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + PROPOSAL_TTL_MS).toISOString();
  const revision = input.revision ?? null;
  const gate = tierIsExecutable(input.tier, input.options);

  return {
    proposalId: randomUUID(),
    action: input.action,
    tier: input.tier,
    targets: input.targets,
    payload: input.payload,
    diff: input.diff ?? [],
    revision,
    expiresAt,
    proposalToken: buildProposalToken({
      serverSecret: input.options.serverSecret,
      actorId: input.principal.userId,
      action: input.action,
      payload: input.payload,
      revision,
      expiresAt,
    }),
    execution: {
      mode: input.options.writeMode,
      executable: gate.executable,
      reason: gate.reason,
    },
  };
}

/**
 * Verify a caller-supplied token against the change it claims to authorize.
 *
 * Every component is recomputed from the *current* call's own values, so a
 * token only validates when the action, the actor, the payload and the
 * revision are all identical to the proposal it came from.
 */
export function verifyProposalToken(input: {
  token: string;
  serverSecret: string;
  actorId: string;
  action: string;
  payload: unknown;
  revision: string | null;
  expiresAt: string;
  now?: Date;
}): void {
  const now = input.now ?? new Date();
  if (Number.isNaN(Date.parse(input.expiresAt))) {
    throw new DomainError("invalid_input", "The proposal expiry is malformed.");
  }
  if (Date.parse(input.expiresAt) < now.getTime()) {
    throw requiresAuthorization(
      "This proposal has expired.",
      { expiresAt: input.expiresAt },
      "Re-run the proposing tool to get a fresh proposal, then execute that one."
    );
  }
  const expected = buildProposalToken({
    serverSecret: input.serverSecret,
    actorId: input.actorId,
    action: input.action,
    payload: input.payload,
    revision: input.revision,
    expiresAt: input.expiresAt,
  });
  if (!timingSafeEqualString(expected, input.token)) {
    throw requiresAuthorization(
      "This proposal token does not match the requested change.",
      { action: input.action },
      "A token authorizes exactly one payload, for one actor, at one revision. Re-run the proposing tool and execute the proposal it returns."
    );
  }
}

/**
 * Constant-time compare, so a token cannot be probed byte by byte.
 *
 * `timingSafeEqual` throws on a length mismatch, so the lengths are compared
 * first — which is safe here because both sides are fixed-length base64url
 * SHA-256 digests, so a length difference only ever means a malformed input.
 */
function timingSafeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * Compute a field-level diff for the proposal.
 *
 * Only keys present in `after` are compared: a partial update should not report
 * every untouched field as "removed".
 */
export function diffFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>
): MutationProposal["diff"] {
  const diff: MutationProposal["diff"] = [];
  for (const [key, next] of Object.entries(after)) {
    const prev = before ? before[key] : undefined;
    if (JSON.stringify(prev ?? null) !== JSON.stringify(next ?? null)) {
      diff.push({ path: key, before: prev ?? null, after: next });
    }
  }
  return diff;
}

/**
 * Single-use enforcement for proposal tokens.
 *
 * `verifyProposalToken` is a pure MAC check: it recomputes the token from the
 * current call's own values and compares. That makes a token unforgeable, and
 * binds it to one actor, action, payload and revision — but it says nothing
 * about how many times that one proposal may be executed. Within the token's
 * ten-minute life the same call verifies every time.
 *
 * For a mutation that is naturally idempotent that is harmless; `setStatus` to
 * the same status twice is the same row. For an *additive* one it is not:
 * `createDraft` and `requestApproval` mint a fresh `ID.unique()` on every call,
 * so a replayed proposal produces a second row that nobody proposed.
 *
 * A proposal therefore authorizes exactly one execution attempt. The token is
 * consumed *before* the write, not after, because the case that matters most is
 * a write whose outcome is unknown — a timeout, a dropped connection. Consuming
 * first means such a call cannot be blindly retried into a duplicate; the
 * caller must re-read the current state and propose again, which is the only
 * safe response to an uncertain mutation.
 *
 * The registry is per-process and deliberately not persisted, exactly like
 * `serverSecret`: a restart invalidates every outstanding proposal, which fails
 * closed. It is not a distributed lock and does not pretend to be one — a
 * future HTTP deployment running several processes needs a shared store, noted
 * in `docs/roadmap.md`.
 */
export interface ProposalRegistry {
  /**
   * Record this token as used. Throws if it was already used.
   * Call this after `verifyProposalToken` and before performing the write.
   */
  consume(token: string, expiresAt: string, now?: Date): void;
  /** Number of tokens currently held. Exposed for tests. */
  readonly size: number;
}

export function createProposalRegistry(): ProposalRegistry {
  const used = new Map<string, number>();

  const prune = (nowMs: number) => {
    for (const [token, expiresAtMs] of used) {
      if (expiresAtMs <= nowMs) {
        used.delete(token);
      }
    }
  };

  return {
    consume(token, expiresAt, now) {
      const nowMs = (now ?? new Date()).getTime();
      // Entries are only useful until the token would expire on its own, so
      // the map stays bounded by the proposal TTL rather than by uptime.
      prune(nowMs);

      if (used.has(token)) {
        throw requiresAuthorization(
          "This proposal has already been executed.",
          {},
          "A proposal authorizes one change. If you are unsure whether the first attempt succeeded, read the current state before proposing again — re-running a mutation whose outcome is unknown can duplicate it."
        );
      }

      // An unparseable expiry must not shorten the retention window —
      // `nowMs` would be pruned on the very next call and turn a malformed
      // field into a replay bypass. Hold it for a full TTL instead.
      const expiresAtMs = Date.parse(expiresAt);
      used.set(
        token,
        Number.isNaN(expiresAtMs) ? nowMs + PROPOSAL_TTL_MS : expiresAtMs
      );
    },
    get size() {
      return used.size;
    },
  };
}
