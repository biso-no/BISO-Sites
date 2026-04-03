"use server";

/**
 * One-time migration: backfill $permissions on existing content and translation rows.
 *
 * Run after:
 *   1. Deleting all old Appwrite teams and re-syncing via M365 login
 *   2. Enabling rowSecurity on content_translations / page_translations
 *
 * How it works:
 *   - Fetches all rows from each content table in batches
 *   - Derives the dept team ID from the row's department_id using the new
 *     deterministic ID format (lowercased SG-App-Dept-{name})
 *   - Derives the campus management team ID from the row's campus_id
 *   - Updates row $permissions using the new model (no campus team, always mgmt team)
 *   - Also backfills $permissions on related translation rows (content_translations
 *     and page_translations) which previously had no row-level permissions
 *
 * Safe to run multiple times (idempotent — Appwrite overwrites permissions).
 */

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { isGlobalAdmin } from "@/lib/authorization";
import { buildContentPermissions, buildPagePermissions } from "@/lib/permissions";
import { getCampusManagementTeamId } from "@/lib/campus-constants";

const DATABASE_ID = "app";
const BATCH_SIZE = 100;

type ContentRow = {
  $id: string;
  campus_id?: string | null;
  department_id?: string | null;
  departmentId?: string | null;
  status?: string | null;
  translation_refs?: Array<{ $id: string } | string> | null;
};

/**
 * Derive the dept team $id from a department_id string stored on a content row.
 * department_id values are stored as the expanded dept name (e.g. "Operations Unit")
 * or the raw camelCase suffix (e.g. "OperationsUnit") depending on when the row
 * was created. We normalize both to the deterministic team ID.
 *
 * Team IDs are: lowercased "SG-App-Dept-{camelCaseName}"
 * e.g. dept name "Operations Unit" -> "sg-app-dept-operationsunit"
 *      dept name "OperationsUnit"  -> "sg-app-dept-operationsunit"
 */
function getDeptTeamIdFromDeptName(deptName: string | null | undefined): string | null {
  if (!deptName) return null;
  // Collapse spaces so "Operations Unit" -> "OperationsUnit" -> "sg-app-dept-operationsunit"
  const normalized = deptName.replace(/\s+/g, "");
  return `sg-app-dept-${normalized.toLowerCase()}`;
}

async function backfillContentTable(
  db: Awaited<ReturnType<typeof createAdminClient>>["db"],
  tableId: string,
  departmentIdField: "department_id" | "departmentId"
): Promise<{ updated: number; translationsUpdated: number; errors: number }> {
  let updated = 0;
  let translationsUpdated = 0;
  let errors = 0;
  let offset = 0;

  while (true) {
    const response = await db.listRows<ContentRow>(DATABASE_ID, tableId, [
      Query.select(["$id", "campus_id", departmentIdField, "status", "translation_refs.$id"]),
      Query.limit(BATCH_SIZE),
      Query.offset(offset),
    ]);

    if (response.rows.length === 0) break;

    for (const row of response.rows) {
      try {
        const deptName =
          departmentIdField === "departmentId" ? row.departmentId : row.department_id;

        const departmentTeamId = getDeptTeamIdFromDeptName(deptName);
        const campusManagementTeamId = getCampusManagementTeamId(row.campus_id ?? "");

        const permissions = buildContentPermissions({
          status: row.status ?? "draft",
          departmentTeamId,
          campusManagementTeamId,
        });

        await db.updateRow(DATABASE_ID, tableId, row.$id, {}, permissions);
        updated++;

        // Backfill translation rows with same permissions
        const refs = row.translation_refs ?? [];
        for (const ref of refs) {
          if (typeof ref === "string") continue;
          const translationTableId =
            tableId === "pages" ? "page_translations" : "content_translations";
          try {
            await db.updateRow(DATABASE_ID, translationTableId, ref.$id, {}, permissions);
            translationsUpdated++;
          } catch (transErr) {
            console.error(
              `Error updating translation ${translationTableId}/${ref.$id}:`,
              transErr
            );
            errors++;
          }
        }
      } catch (err) {
        console.error(`Error updating ${tableId}/${row.$id}:`, err);
        errors++;
      }
    }

    offset += BATCH_SIZE;
    if (response.rows.length < BATCH_SIZE) break;
  }

  return { updated, translationsUpdated, errors };
}

export async function runPermissionsMigration(): Promise<{
  success: boolean;
  results: Record<string, { updated: number; translationsUpdated: number; errors: number }>;
  error?: string;
}> {
  if (!(await isGlobalAdmin())) {
    return { success: false, results: {}, error: "Unauthorized" };
  }

  const { db } = await createAdminClient();

  const results: Record<
    string,
    { updated: number; translationsUpdated: number; errors: number }
  > = {};

  const tables: Array<{
    id: string;
    deptField: "department_id" | "departmentId";
  }> = [
    { id: "events", deptField: "department_id" },
    { id: "jobs", deptField: "department_id" },
    { id: "news", deptField: "department_id" },
    { id: "webshop_products", deptField: "departmentId" },
    { id: "pages", deptField: "department_id" },
  ];

  for (const table of tables) {
    console.log(`Backfilling permissions for ${table.id}...`);
    results[table.id] = await backfillContentTable(db, table.id, table.deptField);
    console.log(`${table.id}: ${JSON.stringify(results[table.id])}`);
  }

  return { success: true, results };
}
