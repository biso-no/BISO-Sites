/**
 * Audit records.
 *
 * Every tool call produces one record on stderr. Mutations additionally attempt
 * an `audit_logs` row, matching what `logAuditEvent` writes from the admin app,
 * so a change made through MCP is visible in the same activity log as one made
 * through the portal rather than being invisible to staff.
 *
 * Writing the row is best-effort and never fails the operation — the same
 * decision `apps/admin/_actions/audit-log.ts` and `apps/api`'s `createAuditLog`
 * both make. It is a real trade-off: an audit gap is possible. It is recorded
 * here rather than hidden, and the stderr record is always written, so the
 * operation is never entirely unattested.
 */

import { ID } from "@repo/api";
import type { BackendClients } from "../appwrite/clients";
import type { Principal } from "../identity/principal";
import type { Logger } from "./logger";
import { redactSecrets } from "./redact";

export interface AuditEvent {
  /** Dotted action, e.g. `content.publish` or `pages.save_draft`. */
  action: string;
  durationMs?: number;
  outcome: "ok" | "denied" | "error" | "proposed" | "read";
  /** Extra context. Redacted before it leaves the process. */
  payload?: Record<string, unknown>;
  requestId: string;
  resourceId?: string;
  resourceType?: string;
}

const AUDIT_TABLE = "audit_logs";
const MAX_PAYLOAD_CHARS = 30_000;

function serialisePayload(
  payload: Record<string, unknown> | undefined
): string | null {
  if (!payload) {
    return null;
  }
  const json = JSON.stringify(redactSecrets(payload));
  if (json.length <= MAX_PAYLOAD_CHARS) {
    return json;
  }
  return JSON.stringify({
    truncated: true,
    note: `payload omitted (${json.length} chars)`,
  });
}

export interface Auditor {
  /** Record a call. Always logs; persists only for mutating outcomes. */
  record(event: AuditEvent): Promise<void>;
}

export function createAuditor(input: {
  clients: BackendClients;
  principal: Principal;
  logger: Logger;
  /** Whether to attempt the `audit_logs` row at all. */
  persist: boolean;
}): Auditor {
  return {
    async record(event: AuditEvent): Promise<void> {
      input.logger.info("audit", {
        requestId: event.requestId,
        action: event.action,
        outcome: event.outcome,
        actorId: input.principal.userId || "anonymous",
        resourceType: event.resourceType ?? null,
        resourceId: event.resourceId ?? null,
        durationMs: event.durationMs ?? null,
        payload: event.payload ?? null,
      });

      const shouldPersist =
        input.persist &&
        event.outcome === "ok" &&
        input.principal.userId !== "" &&
        input.clients.hasElevated;

      if (!shouldPersist) {
        return;
      }

      try {
        // `audit_logs` has `rowSecurity: false` and no table-level grants, so
        // only the service key can write it — the same path the apps use.
        const { db } = input.clients.requireElevated("write audit_logs row");
        await db.createRow("app", AUDIT_TABLE, ID.unique(), {
          actor_id: input.principal.userId,
          actor_email: input.principal.email ?? undefined,
          action: event.action,
          resource_id: event.resourceId,
          resource_type: event.resourceType,
          payload: serialisePayload({
            ...event.payload,
            via: "mcp",
            requestId: event.requestId,
          }),
        });
      } catch (error) {
        input.logger.warn("Failed to persist audit row", {
          requestId: event.requestId,
          action: event.action,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}
