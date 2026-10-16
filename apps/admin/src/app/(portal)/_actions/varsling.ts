"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { VarslingSettings } from "@repo/api/types/appwrite";
import { isSmtpConfigured, sendEmail } from "@repo/connectors/email";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth, type UserAuthContext } from "@/lib/authorization";
import {
  emptyResult,
  type ListParams,
  type PaginatedResult,
} from "@/lib/list-params";
import { paginationQueries } from "@/lib/list-queries";
import { hasNavAccess } from "@/lib/roles";
import { escapeHtml } from "../_components/description-blocks";
import { logAuditEvent } from "./audit-log";

const ROLE_NAME_MAX_LENGTH = 100;
const CAMPUS_ID_MAX_LENGTH = 10;

const varslingSettingSchema = z.object({
  campus_id: z
    .string()
    .trim()
    .min(1, "Campus is required")
    .max(CAMPUS_ID_MAX_LENGTH),
  // `role_name` is what the reporter sees in the public dropdown. It is a
  // string(100), which comfortably fits "Tanweer Akram – HR-sjef", so staff
  // can name a concrete person instead of only a generic role.
  role_name: z
    .string()
    .trim()
    .min(1, "Role or person is required")
    .max(ROLE_NAME_MAX_LENGTH),
  email: z.email("A valid email address is required"),
  sort_order: z.coerce.number().int(),
  is_active: z.boolean(),
});

export interface VarslingSettingFormValues {
  campus_id: string;
  email: string;
  is_active: boolean;
  role_name: string;
  sort_order: number;
}

function buildTestEmailHtml(roleName: string, triggeredBy: string): string {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 16px;font-size:20px;">BISO Varsling – testmelding</h2>
      <p>Denne e-posten bekrefter at varslingssystemet når frem til deg som mottaker for <strong>${escapeHtml(roleName)}</strong>.</p>
      <p>Ingen sak er meldt inn. Du trenger ikke gjøre noe.</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #e5e5e5;" />
      <p style="font-size:11px;color:#aaa;">Utløst fra BISO admin av ${escapeHtml(triggeredBy)}.</p>
    </div>`;
}

function buildTestEmailText(roleName: string, triggeredBy: string): string {
  return [
    "BISO Varsling – testmelding",
    "",
    `Denne e-posten bekrefter at varslingssystemet når frem til deg som mottaker for ${roleName}.`,
    "Ingen sak er meldt inn. Du trenger ikke gjøre noe.",
    "",
    "--",
    `Utløst fra BISO admin av ${triggeredBy}.`,
  ].join("\n");
}

/**
 * `varsling` is global-admin only (see `NAV_ACCESS` in `lib/roles.ts`). These
 * rows drive who receives whistleblowing reports, so there is no campus-admin
 * or department fallback.
 */
function canManageVarsling(ctx: UserAuthContext): boolean {
  return hasNavAccess("varsling", ctx.roles, ctx.departmentTeamIds.length > 0);
}

export async function listVarslingSettings(
  // `params.q` is intentionally ignored: search is not implemented for this
  // surface.
  params: ListParams
): Promise<PaginatedResult<VarslingSettings>> {
  const ctx = await requireAuth();
  if (!canManageVarsling(ctx)) {
    return emptyResult<VarslingSettings>(params);
  }

  const { db } = await createAdminClient();
  const response = await db.listRows<VarslingSettings>(
    "app",
    "varsling_settings",
    [
      Query.orderAsc("campus_id"),
      Query.orderAsc("sort_order"),
      Query.orderAsc("role_name"),
      ...paginationQueries(params),
    ]
  );

  return {
    rows: response.rows,
    total: response.total,
    page: params.page,
    size: params.size,
  };
}

export async function createVarslingSetting(
  values: VarslingSettingFormValues
): Promise<{ data: string } | { error: string }> {
  const ctx = await requireAuth();
  if (!canManageVarsling(ctx)) {
    return { error: "Not authorized to manage varsling contacts" };
  }

  const validated = varslingSettingSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Invalid form data" };
  }

  try {
    const { db } = await createAdminClient();
    const row = await db.createRow(
      "app",
      "varsling_settings",
      ID.unique(),
      validated.data
    );

    await logAuditEvent(ctx, "varsling_setting.create", {
      resourceId: row.$id,
      resourceType: "varsling_setting",
      payload: {
        campus_id: validated.data.campus_id,
        role_name: validated.data.role_name,
      },
    });
    revalidatePath("/varsling");
    return { data: row.$id };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create contact",
    };
  }
}

export async function updateVarslingSetting(
  id: string,
  values: VarslingSettingFormValues
): Promise<{ data: string } | { error: string }> {
  const ctx = await requireAuth();
  if (!canManageVarsling(ctx)) {
    return { error: "Not authorized to manage varsling contacts" };
  }

  const validated = varslingSettingSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Invalid form data" };
  }

  try {
    const { db } = await createAdminClient();
    await db.updateRow("app", "varsling_settings", id, validated.data);

    await logAuditEvent(ctx, "varsling_setting.update", {
      resourceId: id,
      resourceType: "varsling_setting",
      payload: { is_active: validated.data.is_active },
    });
    revalidatePath("/varsling");
    return { data: id };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update contact",
    };
  }
}

export async function setVarslingSettingActive(
  id: string,
  isActive: boolean
): Promise<{ data: boolean } | { error: string }> {
  const ctx = await requireAuth();
  if (!canManageVarsling(ctx)) {
    return { error: "Not authorized to manage varsling contacts" };
  }

  try {
    const { db } = await createAdminClient();
    await db.updateRow("app", "varsling_settings", id, {
      is_active: isActive,
    });

    await logAuditEvent(ctx, "varsling_setting.toggle_active", {
      resourceId: id,
      resourceType: "varsling_setting",
      payload: { is_active: isActive },
    });
    revalidatePath("/varsling");
    return { data: isActive };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update contact",
    };
  }
}

/**
 * Sends a sample report to one contact's address so staff can prove the SMTP
 * relay reaches them before a real reporter depends on it. Deliberately mailed
 * to the stored address, never to a caller-supplied one.
 */
export async function sendVarslingTestEmail(
  id: string
): Promise<{ data: string } | { error: string }> {
  const ctx = await requireAuth();
  if (!canManageVarsling(ctx)) {
    return { error: "Not authorized to manage varsling contacts" };
  }

  if (!isSmtpConfigured()) {
    return {
      error:
        "SMTP is not configured on this deployment — set SMTP_HOST and SMTP_FROM.",
    };
  }

  try {
    const { db } = await createAdminClient();
    const setting = await db.getRow<VarslingSettings>(
      "app",
      "varsling_settings",
      id
    );

    // `email` and `name` are both nullable on the auth context; the user id is
    // the only field guaranteed to identify who triggered the test.
    const triggeredBy = ctx.email ?? ctx.name ?? ctx.userId;

    await sendEmail({
      html: buildTestEmailHtml(setting.role_name, triggeredBy),
      subject: "BISO Varsling – testmelding",
      text: buildTestEmailText(setting.role_name, triggeredBy),
      to: setting.email,
    });

    await logAuditEvent(ctx, "varsling_setting.test_email", {
      resourceId: id,
      resourceType: "varsling_setting",
      payload: { role_name: setting.role_name },
    });

    return { data: setting.email };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to send test email",
    };
  }
}

export async function deleteVarslingSetting(
  id: string
): Promise<{ data: true } | { error: string }> {
  const ctx = await requireAuth();
  if (!canManageVarsling(ctx)) {
    return { error: "Not authorized to manage varsling contacts" };
  }

  try {
    const { db } = await createAdminClient();
    await db.deleteRow("app", "varsling_settings", id);

    await logAuditEvent(ctx, "varsling_setting.delete", {
      resourceId: id,
      resourceType: "varsling_setting",
    });
    revalidatePath("/varsling");
    return { data: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to delete contact",
    };
  }
}
