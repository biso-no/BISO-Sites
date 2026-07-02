"use server";

import { ID } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  type M365TurnoverInput,
  m365TurnoverSchema,
} from "@repo/shared/types/user-management";
import { revalidatePath } from "next/cache";
import { getGraphService } from "@/lib/it/graph";
import { getAllowedTenantUser } from "@/lib/it/tenant-guard";
import {
  buildTurnoverProfilePatch,
  computeRetentionStopAt,
  postRetentionWebhook,
  RETENTION_RUN_DAYS,
  resetUserMfaMethods,
} from "@/lib/it/turnover";
import { requireItPermission } from "@/lib/it-permissions";
import { logAuditEvent } from "./audit-log";

const TURNOVER_JOBS_TABLE = "m365_turnover_jobs";

type ActionResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: string };

export interface M365TurnoverResult {
  jobId: string;
  newDisplayName: string;
  previousDisplayName: string;
  retentionStarted: boolean;
  retentionStopAt: string;
  // Non-fatal lockout/retention steps that failed; the turnover still
  // completed (the rename already happened) but these need manual follow-up.
  warnings: string[];
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

/**
 * Repoint a role identity to a new holder.
 *
 * The login address (UPN/mail) is left untouched — only the human-facing name
 * changes. The departing holder is locked out (MFA reset, sessions revoked,
 * password reset at next sign-in) and a 7-day Azure Automation retention run is
 * started to clear their Teams history; the stop-retention cron tears it down
 * once {@link RETENTION_RUN_DAYS} have passed.
 *
 * The rename is the point-of-no-return step and runs first; the lockout and
 * retention steps are best-effort and surfaced as warnings so a single Graph
 * hiccup doesn't leave the operator unsure whether the handover happened.
 */
export async function triggerM365Turnover(
  input: M365TurnoverInput
): Promise<ActionResult<M365TurnoverResult>> {
  let parsed: M365TurnoverInput | null = null;
  const warnings: string[] = [];

  try {
    parsed = m365TurnoverSchema.parse(input);
    const ctx = await requireItPermission("it.users.turnover");

    const graph = getGraphService();
    const user = await getAllowedTenantUser(graph, parsed.userId);

    // Confirm the operator is repurposing the intended role account.
    if (
      parsed.confirmationUpn.trim().toLowerCase() !==
      user.userPrincipalName.toLowerCase()
    ) {
      return {
        error:
          "Confirmation address does not match this account's login address.",
      };
    }

    const previousDisplayName = user.displayName;
    const patch = buildTurnoverProfilePatch(
      parsed.newFirstName,
      parsed.newLastName
    );

    // 1. Rename (point of no return — do this first and let it throw on failure).
    await graph.updateUser(user.id, patch);

    // 2. Lock out the departing holder. Each step is best-effort so one Graph
    //    failure doesn't skip the others.
    try {
      await resetUserMfaMethods(graph, user.id);
    } catch (error) {
      warnings.push(`MFA reset failed: ${getErrorMessage(error)}`);
    }
    try {
      await graph.revokeSignInSessions(user.id);
    } catch (error) {
      warnings.push(`Session revocation failed: ${getErrorMessage(error)}`);
    }
    try {
      await graph.forcePasswordResetNextSignIn(user.id);
    } catch (error) {
      warnings.push(`Password reset flag failed: ${getErrorMessage(error)}`);
    }

    // 3. Record the turnover job, then start the retention run.
    const jobId = ID.unique();
    const retentionStopAt = computeRetentionStopAt(Date.now());
    const { db } = await createAdminClient();

    const startUrl = process.env.AZURE_RETENTION_START_WEBHOOK_URL;
    let retentionStarted = false;
    let status = "retention_active";
    let lastError: string | null = null;
    let retentionStartedAt: string | null = null;

    if (startUrl) {
      const result = await postRetentionWebhook(startUrl, {
        action: "start",
        userId: user.id,
        userUpn: user.userPrincipalName,
        retentionDays: RETENTION_RUN_DAYS,
        turnoverJobId: jobId,
      });
      if (result.ok) {
        retentionStarted = true;
        retentionStartedAt = new Date().toISOString();
      } else {
        status = "retention_start_failed";
        lastError = result.error ?? "Retention start webhook failed";
        warnings.push(`Retention run did not start: ${lastError}`);
      }
    } else {
      status = "retention_start_failed";
      lastError = "AZURE_RETENTION_START_WEBHOOK_URL is not configured";
      warnings.push(lastError);
    }

    await db.createRow("app", TURNOVER_JOBS_TABLE, jobId, {
      user_id: user.id,
      user_upn: user.userPrincipalName,
      previous_display_name: previousDisplayName,
      new_display_name: patch.displayName,
      new_given_name: patch.givenName,
      new_surname: patch.surname,
      initiated_by_user_id: ctx.userId,
      retention_started_at: retentionStartedAt,
      retention_stop_at: retentionStopAt,
      status,
      stop_attempts: 0,
      last_error: lastError,
    });

    await logAuditEvent(ctx, "it.m365.user.turnover", {
      resourceId: user.id,
      resourceType: "m365.user",
      payload: {
        success: true,
        jobId,
        userUpn: user.userPrincipalName,
        previousDisplayName,
        newDisplayName: patch.displayName,
        retentionStarted,
        retentionStopAt,
        warnings,
      },
    });

    revalidatePath("/it/users");
    revalidatePath(`/it/users/${parsed.userId}`);

    return {
      data: {
        jobId,
        newDisplayName: patch.displayName,
        previousDisplayName,
        retentionStarted,
        retentionStopAt,
        warnings,
      },
    };
  } catch (error) {
    const ctx = await requireItPermission("it.users.turnover").catch(
      () => null
    );
    if (ctx) {
      await logAuditEvent(ctx, "it.m365.user.turnover", {
        resourceId: parsed?.userId,
        resourceType: "m365.user",
        payload: { success: false, error: getErrorMessage(error) },
      }).catch(() => undefined);
    }
    return { error: getErrorMessage(error) };
  }
}
