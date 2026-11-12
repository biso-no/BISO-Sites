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
import { getGraphService } from "@/lib/it/graph";
import { ROLES } from "@/lib/roles";
import { logAuditEvent } from "../../../_actions/audit-log";
import {
  APPROVER_LIST_CAP,
  type ApproverActionResult,
  type ApproverErrorCode,
  type ApproverFilters,
  type ApproverInput,
  type ApproverList,
  type ApproverView,
  type ApproverViewer,
  canEditApproverRow,
  parseApproverInput,
} from "./approvers-model";

const PAGE_PATH = "/expenses/settings/approvers";
const TABLE = "expense_approvers";
const DEPARTMENT_LIMIT = 500;
const GRAPH_LOOKUP_TIMEOUT_MS = 6000;

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

/** The signed-in admin, or null for anyone who may not manage approvers. */
async function requireApproverEditor(): Promise<{
  ctx: UserAuthContext;
  viewer: ApproverViewer;
} | null> {
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
    return null;
  }
  return { ctx, viewer };
}

function failure(error: unknown, what: string): { error: "failed" } {
  if (isRedirectError(error)) {
    throw error;
  }
  console.error(`[expense-approvers] ${what} failed:`, error);
  return { error: "failed" };
}

/**
 * The person's Microsoft 365 account id and name, so a Teams card can reach
 * them. Best-effort: null when Graph can't find them, fails or takes over 6 s.
 */
async function lookupPerson(
  email: string
): Promise<{ aadId: string; displayName: string | null } | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const user = await Promise.race([
      getGraphService().getUser(email),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Graph lookup timed out")),
          GRAPH_LOOKUP_TIMEOUT_MS
        );
      }),
    ]);
    return user?.id
      ? { aadId: user.id, displayName: user.displayName || null }
      : null;
  } catch (error) {
    console.warn("[expense-approvers] Graph lookup failed:", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
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
    Query.limit(DEPARTMENT_LIMIT),
  ]);
  return new Map(result.rows.map((row) => [row.$id, row.Name]));
}

/**
 * Matches the name, the email or the department name, in the query so the cap
 * applies to matching rows. Department names live in another table, so they
 * match through their ids.
 */
function searchQuery(needle: string, departmentNames: Map<string, string>) {
  const lower = needle.toLowerCase();
  const departmentIds = [...departmentNames]
    .filter(([, name]) => name.toLowerCase().includes(lower))
    .map(([id]) => id);
  return Query.or([
    Query.contains("email", lower),
    Query.contains("display_name", needle),
    ...(departmentIds.length > 0
      ? [Query.equal("department_id", departmentIds)]
      : []),
  ]);
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

/**
 * Approver rows the viewer may see, filtered, up to `APPROVER_LIST_CAP`.
 * Global admins see every campus.
 */
export async function listApprovers(
  filters: ApproverFilters
): Promise<ApproverActionResult<ApproverList>> {
  try {
    const editor = await requireApproverEditor();
    if (!editor) {
      return { error: "forbidden" };
    }
    const { viewer } = editor;
    const { db } = await createAdminClient();
    // One extra row says whether more exist than the list shows.
    const queries = [
      Query.orderAsc("campus_id"),
      Query.limit(APPROVER_LIST_CAP + 1),
    ];
    if (viewer.isGlobalAdmin) {
      if (filters.campusId) {
        queries.push(Query.equal("campus_id", filters.campusId));
      }
    } else {
      const allowed = filters.campusId
        ? viewer.managedCampusIds.filter((id) => id === filters.campusId)
        : viewer.managedCampusIds;
      if (allowed.length === 0) {
        return { data: { capped: false, rows: [] } };
      }
      queries.push(Query.equal("campus_id", allowed));
    }
    if (filters.role) {
      queries.push(Query.equal("role", filters.role));
    }
    const names = await readDepartmentNames(db);
    const needle = filters.q.trim();
    if (needle) {
      queries.push(searchQuery(needle, names));
    }
    const result = await db.listRows<ExpenseApprovers>("app", TABLE, queries);
    return {
      data: {
        capped: result.rows.length > APPROVER_LIST_CAP,
        rows: result.rows
          .slice(0, APPROVER_LIST_CAP)
          .map((row) => toView(row, names, viewer)),
      },
    };
  } catch (error) {
    return failure(error, "list");
  }
}

/**
 * The row a save writes to: the edited row, or the row already on the key, or
 * null for a new row. Refuses a key another row holds, and any row outside
 * the viewer's reach.
 */
async function findSaveTarget(
  db: AdminDb,
  viewer: ApproverViewer,
  id: string | undefined,
  key: string
): Promise<{ target: ExpenseApprovers | null } | { error: ApproverErrorCode }> {
  const stored = id
    ? await db.getRow<ExpenseApprovers>("app", TABLE, id)
    : null;
  if (stored && !canEditApproverRow(viewer, stored)) {
    return { error: "forbidden" };
  }
  const sameKey = await db.listRows<ExpenseApprovers>("app", TABLE, [
    Query.equal("key", key),
    Query.limit(1),
  ]);
  const clash = sameKey.rows[0] ?? null;
  if (clash && stored && clash.$id !== stored.$id) {
    return { error: "role_taken" };
  }
  // A new row on an existing key updates that row, so it is checked too.
  const target = stored ?? clash;
  if (target && !canEditApproverRow(viewer, target)) {
    return { error: "forbidden" };
  }
  return { target };
}

/**
 * Creates or updates an approver. A new row whose key already exists updates
 * that row. Audited. Authorization is re-checked on the stored row and on the
 * row as it will be written. A new email is a new person: their Microsoft 365
 * id is looked up again and the AI's confidence and the confirmation cleared.
 */
export async function saveApprover(
  input: ApproverInput
): Promise<ApproverActionResult<ApproverView>> {
  try {
    const editor = await requireApproverEditor();
    if (!editor) {
      return { error: "forbidden" };
    }
    const { ctx, viewer } = editor;
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
        return { error: "department_mismatch" };
      }
      names.set(department.$id, department.Name);
    }

    const key = directoryKey({ campusId, departmentId, role, scope });
    const found = await findSaveTarget(db, viewer, input.id, key);
    if ("error" in found) {
      return found;
    }
    const { target } = found;

    // The stored account id, confidence and confirmation belong to the old
    // person, so a new email replaces all three.
    const emailChanged = !target || target.email !== email;
    const person = emailChanged ? await lookupPerson(email) : null;
    const identity = {
      aad_id: person?.aadId ?? null,
      confidence: null,
      confirmed_at: null,
    };
    const fields = {
      active: true,
      campus_id: campusId,
      department_id: departmentId,
      display_name: input.displayName?.trim() || person?.displayName || null,
      email,
      key,
      role: role as ExpenseApproversRole,
      scope: scope as ExpenseApproversScope,
      source: "admin" as ExpenseApproversSource,
      ...(emailChanged ? identity : {}),
    };
    const row = target
      ? await db.updateRow<ExpenseApprovers>("app", TABLE, target.$id, fields)
      : await db.createRow<ExpenseApprovers>("app", TABLE, ID.unique(), {
          ...fields,
          ...identity,
          last_used_at: null,
        });

    await logAuditEvent(
      ctx,
      target ? "expense_approver.update" : "expense_approver.create",
      { payload: fields, resourceId: row.$id, resourceType: TABLE }
    );
    revalidatePath(PAGE_PATH);
    return { data: toView(row, names, viewer) };
  } catch (error) {
    return failure(error, "save");
  }
}

/** Turns an approver on or off. Audited. */
export async function setApproverActive(input: {
  active: boolean;
  id: string;
}): Promise<ApproverActionResult<{ active: boolean }>> {
  try {
    const editor = await requireApproverEditor();
    if (!editor) {
      return { error: "forbidden" };
    }
    const { ctx, viewer } = editor;
    const { db } = await createAdminClient();
    const stored = await db.getRow<ExpenseApprovers>("app", TABLE, input.id);
    if (!canEditApproverRow(viewer, stored)) {
      return { error: "forbidden" };
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
    return failure(error, "active switch");
  }
}
