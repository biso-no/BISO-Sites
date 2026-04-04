"use server";

import { createAdminClient } from "@repo/api/server";
import type { UserAuthContext } from "@/lib/authorization";

export async function logAuditEvent(
  ctx: UserAuthContext,
  action: string,
  opts?: {
    resourceId?: string;
    resourceType?: string;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const { db } = await createAdminClient();
    await db.createRow("app", "audit_logs", "unique()", {
      actor_id: ctx.userId,
      actor_email: ctx.email ?? null,
      action,
      resource_id: opts?.resourceId ?? null,
      resource_type: opts?.resourceType ?? null,
      payload: opts?.payload ? JSON.stringify(opts.payload) : null,
    });
  } catch (e) {
    console.error("[audit] Failed to write audit log:", e);
  }
}
