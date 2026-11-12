"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  Departments,
  ExpenseApprovers,
  ExpenseApproversRole,
  ExpenseApproversScope,
  ExpenseApproversSource,
} from "@repo/api/types/appwrite";
import { directoryKey } from "@repo/shared/utils/expense-approvers";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import { ROLES } from "@/lib/roles";
import { logAuditEvent } from "../../../_actions/audit-log";
import type { ActionResult } from "../../action-result";
import {
  type ApproverFilters,
  type ApproverInput,
  type ApproverView,
  type ApproverViewer,
  canEditApproverRow,
  parseApproverInput,
} from "./approvers-model";

const PAGE_PATH = "/expenses/settings/approvers";
const TABLE = "expense_approvers";
const MAX_ROWS = 500;

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

async function requireApproverEditor(): Promise<{
  ctx: UserAuthContext;
  viewer: ApproverViewer;
}> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  const viewer: ApproverViewer = {
    isCampusAdmin: ctx.roles.includes(ROLES.CAMPUS_ADMIN),
    isGlobalAdmin: ctx.roles.includes(ROLES.GLOBAL_ADMIN),
    managedCampusIds: ctx.managedCampusIds,
  };
  if (!(viewer.isGlobalAdmin || viewer.isCampusAdmin)) {
    throw new Error("Forbidden: only admins can manage approvers");
  }
  return { ctx, viewer };
}

function failure(error: unknown, fallback: string): { error: string } {
  if (isRedirectError(error)) {
    throw error;
  }
  return { error: error instanceof Error ? error.message : fallback };
}

function toView(
  row: ExpenseApprovers,
  departmentNames: Map<string, string>,
  viewer: ApproverViewer
): ApproverView {
  return {
    $id: row.$id,
    active: row.active !== false,
    campusId: row.campus_id,
    confidence: row.confidence ?? null,
    confirmedAt: row.confirmed_at ?? null,
    departmentId: row.department_id ?? null,
    departmentName: row.department_id
      ? (departmentNames.get(row.department_id) ?? null)
      : null,
    displayName: row.display_name ?? null,
    editable: canEditApproverRow(viewer, row),
    email: row.email,
    lastUsedAt: row.last_used_at ?? null,
    role: row.role,
    scope: row.scope,
    source: row.source,
  };
}

async function readDepartmentNames(db: AdminDb): Promise<Map<string, string>> {
  const result = await db.listRows<Departments>("app", "departments", [
    Query.select(["$id", "Name"]),
    Query.limit(MAX_ROWS),
  ]);
  return new Map(result.rows.map((row) => [row.$id, row.Name]));
}

/** The department, when it exists and sits on `campusId`. */
async function readDepartment(
  db: AdminDb,
  departmentId: string,
  campusId: string
): Promise<Departments | null> {
  const department = await db
    .getRow<Departments>("app", "departments", departmentId)
    .catch(() => null);
  return department && department.campus_id === campusId ? department : null;
}

/** Approver rows the viewer may see, filtered. Global admins see every campus. */
export async function listApprovers(
  filters: ApproverFilters
): Promise<ActionResult<ApproverView[]>> {
  try {
    const { viewer } = await requireApproverEditor();
    const { db } = await createAdminClient();
    const queries = [Query.orderAsc("campus_id"), Query.limit(MAX_ROWS)];
    if (viewer.isGlobalAdmin) {
      if (filters.campusId) {
        queries.push(Query.equal("campus_id", filters.campusId));
      }
    } else {
      const allowed = filters.campusId
        ? viewer.managedCampusIds.filter((id) => id === filters.campusId)
        : viewer.managedCampusIds;
      if (allowed.length === 0) {
        return { data: [] };
      }
      queries.push(Query.equal("campus_id", allowed));
    }
    if (filters.role) {
      queries.push(Query.equal("role", filters.role));
    }
    const [result, names] = await Promise.all([
      db.listRows<ExpenseApprovers>("app", TABLE, queries),
      readDepartmentNames(db),
    ]);
    const needle = filters.q.trim().toLowerCase();
    const views = result.rows
      .map((row) => toView(row, names, viewer))
      .filter(
        (view) =>
          !needle ||
          [view.displayName, view.email, view.departmentName]
            .filter(Boolean)
            .some((text) => text?.toLowerCase().includes(needle))
      );
    return { data: views };
  } catch (error) {
    return failure(error, "Failed to load approvers");
  }
}

/**
 * Creates or updates an approver. A new row whose key already exists updates
 * that row. Audited. Authorization is re-checked on the stored row and on the
 * row as it will be written.
 */
export async function saveApprover(
  input: ApproverInput
): Promise<ActionResult<ApproverView>> {
  try {
    const { ctx, viewer } = await requireApproverEditor();
    const parsed = parseApproverInput(viewer, input);
    if ("error" in parsed) {
      return parsed;
    }
    const { campusId, departmentId, email, role, scope } = parsed.value;

    const { db } = await createAdminClient();
    const names = new Map<string, string>();
    if (departmentId) {
      const department = await readDepartment(db, departmentId, campusId);
      if (!department) {
        return { error: "The department does not belong to that campus" };
      }
      names.set(department.$id, department.Name);
    }

    const stored = input.id
      ? await db.getRow<ExpenseApprovers>("app", TABLE, input.id)
      : null;
    if (stored && !canEditApproverRow(viewer, stored)) {
      return { error: "Forbidden: this approver is outside your campus" };
    }

    const key = directoryKey({ campusId, departmentId, role, scope });
    const sameKey = await db.listRows<ExpenseApprovers>("app", TABLE, [
      Query.equal("key", key),
      Query.limit(1),
    ]);
    const clash = sameKey.rows[0] ?? null;
    if (clash && stored && clash.$id !== stored.$id) {
      return { error: "Another approver already holds that role" };
    }
    // A new row on an existing key updates that row, so it is checked too.
    const target = stored ?? clash;
    if (target && !canEditApproverRow(viewer, target)) {
      return { error: "Forbidden: this approver is outside your campus" };
    }

    const fields = {
      active: true,
      campus_id: campusId,
      department_id: departmentId,
      display_name: input.displayName?.trim() || null,
      email,
      key,
      role: role as ExpenseApproversRole,
      scope: scope as ExpenseApproversScope,
      source: "admin" as ExpenseApproversSource,
    };
    const confirmedAt =
      !target || target.email !== email ? { confirmed_at: null } : {};
    let row: ExpenseApprovers;
    if (target) {
      row = await db.updateRow<ExpenseApprovers>("app", TABLE, target.$id, {
        ...fields,
        ...confirmedAt,
      });
    } else {
      row = await db.createRow<ExpenseApprovers>("app", TABLE, ID.unique(), {
        ...fields,
        aad_id: null,
        confirmed_at: null,
        confidence: null,
        last_used_at: null,
      });
    }

    await logAuditEvent(
      ctx,
      target ? "expense_approver.update" : "expense_approver.create",
      {
        payload: { ...fields, ...confirmedAt },
        resourceId: row.$id,
        resourceType: TABLE,
      }
    );
    revalidatePath(PAGE_PATH);
    return { data: toView(row, names, viewer) };
  } catch (error) {
    return failure(error, "Failed to save approver");
  }
}

/** Turns an approver on or off. Audited. */
export async function setApproverActive(input: {
  active: boolean;
  id: string;
}): Promise<ActionResult<{ active: boolean }>> {
  try {
    const { ctx, viewer } = await requireApproverEditor();
    const { db } = await createAdminClient();
    const stored = await db.getRow<ExpenseApprovers>("app", TABLE, input.id);
    if (!canEditApproverRow(viewer, stored)) {
      return { error: "Forbidden: this approver is outside your campus" };
    }
    await db.updateRow("app", TABLE, input.id, { active: input.active });
    await logAuditEvent(ctx, "expense_approver.set_active", {
      payload: { active: input.active, key: stored.key },
      resourceId: input.id,
      resourceType: TABLE,
    });
    revalidatePath(PAGE_PATH);
    return { data: { active: input.active } };
  } catch (error) {
    return failure(error, "Failed to update approver");
  }
}
