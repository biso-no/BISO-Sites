import { ID, Query } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import type { ExpenseApprovers } from "@repo/api/types/appwrite";

type Db = Awaited<ReturnType<typeof createAdminClient>>["db"];

export interface DirectoryApprover {
  aadId: string | null;
  displayName: string | null;
  email: string;
  key: string;
  source: "seed" | "ai" | "admin" | "confirmed";
}

export interface DirectoryApproverInput {
  aadId?: string | null;
  campusId: string;
  confidence?: number | null;
  departmentId?: string | null;
  displayName?: string | null;
  email: string;
  key: string;
  role: ExpenseApprovers["role"] | `${ExpenseApprovers["role"]}`;
  scope: "department" | "campus";
  source: DirectoryApprover["source"];
}

const DB = "app";
const TABLE = "expense_approvers";
/** Sources a person set; the AI and the seed never overwrite them. */
const PROTECTED_SOURCES = new Set(["admin", "confirmed"]);

/** Sources a decision turns into "confirmed". */
const CONFIRMABLE_SOURCES = new Set(["ai", "seed"]);

function isConflict(error: unknown): boolean {
  const e = error as { code?: unknown; type?: unknown } | null;
  return e?.code === 409 || e?.type === "row_already_exists";
}

async function activeRow(
  db: Db,
  key: string
): Promise<ExpenseApprovers | null> {
  const { rows } = await db.listRows<ExpenseApprovers>(DB, TABLE, [
    Query.equal("key", key),
    Query.equal("active", true),
    Query.limit(1),
  ]);
  return rows[0] ?? null;
}

/** True when the key has a row an admin deactivated: it stays off. */
export async function hasInactiveDirectoryRow(
  db: Db,
  key: string
): Promise<boolean> {
  try {
    const { rows } = await db.listRows<ExpenseApprovers>(DB, TABLE, [
      Query.equal("key", key),
      Query.equal("active", false),
      Query.limit(1),
    ]);
    return rows.length > 0;
  } catch (error) {
    console.error("[expense-approver-directory] inactive check failed", error);
    return false;
  }
}

export async function findDirectoryApprover(
  db: Db,
  key: string
): Promise<DirectoryApprover | null> {
  try {
    const row = await activeRow(db, key);
    if (!row) {
      return null;
    }
    return {
      aadId: row.aad_id ?? null,
      displayName: row.display_name ?? null,
      email: row.email,
      key,
      source: row.source as DirectoryApprover["source"],
    };
  } catch (error) {
    console.error("[expense-approver-directory] find failed", error);
    return null;
  }
}

export async function saveDirectoryApprover(
  db: Db,
  input: DirectoryApproverInput
): Promise<void> {
  const data = {
    key: input.key,
    scope: input.scope,
    campus_id: input.campusId,
    department_id: input.departmentId ?? null,
    role: input.role,
    email: input.email.trim().toLowerCase(),
    aad_id: input.aadId ?? null,
    display_name: input.displayName ?? null,
    source: input.source,
    confidence: input.confidence ?? null,
    active: true,
  };
  try {
    await db.createRow(DB, TABLE, ID.unique(), data);
    return;
  } catch (error) {
    if (!isConflict(error)) {
      console.error("[expense-approver-directory] save failed", error);
      return;
    }
  }
  try {
    const { rows } = await db.listRows<ExpenseApprovers>(DB, TABLE, [
      Query.equal("key", input.key),
      Query.limit(1),
    ]);
    const existing = rows[0];
    if (
      !existing ||
      existing.active === false ||
      PROTECTED_SOURCES.has(existing.source)
    ) {
      return;
    }
    await db.updateRow(DB, TABLE, existing.$id, data);
  } catch (error) {
    console.error("[expense-approver-directory] update failed", error);
  }
}

/**
 * Sets the directory entry for `input.key` as an admin choice, replacing whatever
 * is there (even a confirmed or admin entry): a person changed it on purpose.
 * Clears the confirmation, so the new approver confirms by deciding. Best-effort:
 * a failed write is logged and reported as `false`.
 */
export async function setAdminDirectoryApprover(
  db: Db,
  input: Omit<DirectoryApproverInput, "confidence" | "source">
): Promise<boolean> {
  const data = {
    key: input.key,
    scope: input.scope,
    campus_id: input.campusId,
    department_id: input.departmentId ?? null,
    role: input.role,
    email: input.email.trim().toLowerCase(),
    aad_id: input.aadId ?? null,
    display_name: input.displayName ?? null,
    source: "admin",
    confidence: null,
    confirmed_at: null,
    active: true,
  };
  try {
    const { rows } = await db.listRows<ExpenseApprovers>(DB, TABLE, [
      Query.equal("key", input.key),
      Query.limit(1),
    ]);
    const existing = rows[0];
    if (existing) {
      await db.updateRow(DB, TABLE, existing.$id, data);
      return true;
    }
    await db.createRow(DB, TABLE, ID.unique(), data);
    return true;
  } catch (error) {
    console.error("[expense-approver-directory] admin save failed", error);
    return false;
  }
}

export async function touchDirectoryApprover(
  db: Db,
  key: string
): Promise<void> {
  try {
    const row = await activeRow(db, key);
    if (row) {
      await db.updateRow(DB, TABLE, row.$id, {
        last_used_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("[expense-approver-directory] touch failed", error);
  }
}

export async function confirmDirectoryApprover(
  db: Db,
  key: string,
  email: string
): Promise<void> {
  try {
    const row = await activeRow(db, key);
    if (!row || row.email.toLowerCase() !== email.toLowerCase()) {
      return;
    }
    // An admin's choice stays an admin choice; only guesses become confirmed.
    const keepsSource = !CONFIRMABLE_SOURCES.has(row.source);
    await db.updateRow(DB, TABLE, row.$id, {
      ...(keepsSource ? {} : { source: "confirmed" }),
      confirmed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[expense-approver-directory] confirm failed", error);
  }
}
