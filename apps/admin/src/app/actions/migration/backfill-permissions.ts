"use server";

/**
 * One-time migration: backfill $permissions on existing content documents.
 *
 * Run this ONCE after enabling rowSecurity on content tables.
 *
 * How it works:
 * - Fetches all rows from each content table in batches
 * - Looks up the Appwrite team IDs for their campus and department
 * - Calls updateRow with the appropriate $permissions based on status
 *
 * Safe to run multiple times (idempotent — Appwrite overwrites permissions).
 */

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { isGlobalAdmin } from "@/lib/authorization";
import { CAMPUS_ID_TO_NAME } from "@/lib/campus-constants";
import { buildContentPermissions } from "@/lib/permissions";

const DATABASE_ID = "app";
const BATCH_SIZE = 100;

type ContentRow = {
  $id: string;
  campus_id?: string | null;
  department_id?: string | null;
  departmentId?: string | null;
  status?: string | null;
};

function getTeamIdForCampusId(
  campusId: string | null | undefined,
  teamsList: Array<{ $id: string; name: string }>
): string | null {
  if (!campusId) return null;
  const campusName = CAMPUS_ID_TO_NAME[campusId];
  if (!campusName) return null;
  const team = teamsList.find((t) => t.name === `SG-App-Campus-${campusName}`);
  return team?.$id ?? null;
}

function getTeamIdForDepartment(
  departmentName: string | null | undefined,
  teamsList: Array<{ $id: string; name: string }>
): string | null {
  if (!departmentName) return null;
  const team = teamsList.find(
    (t) => t.name === `SG-App-Dept-${departmentName}`
  );
  return team?.$id ?? null;
}

async function backfillTable(
  db: Awaited<ReturnType<typeof createAdminClient>>["db"],
  teams: Awaited<ReturnType<typeof createAdminClient>>["teams"],
  tableId: string,
  departmentIdField: "department_id" | "departmentId" = "department_id"
): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;
  let offset = 0;

  const allTeams = await teams.list();
  const teamsList = allTeams.teams;

  while (true) {
    const response = await db.listRows<ContentRow>(DATABASE_ID, tableId, [
      Query.select(["$id", "campus_id", departmentIdField, "status"]),
      Query.limit(BATCH_SIZE),
      Query.offset(offset),
    ]);

    if (response.rows.length === 0) break;

    for (const row of response.rows) {
      try {
        const deptFieldValue =
          departmentIdField === "departmentId"
            ? row.departmentId
            : row.department_id;

        const campusTeamId = getTeamIdForCampusId(row.campus_id, teamsList);
        const departmentTeamId = getTeamIdForDepartment(deptFieldValue, teamsList);

        const permissions = buildContentPermissions({
          status: row.status ?? "draft",
          campusTeamId,
          departmentTeamId,
        });

        await db.updateRow(DATABASE_ID, tableId, row.$id, {}, permissions);
        updated++;
      } catch (err) {
        console.error(`Error updating ${tableId}/${row.$id}:`, err);
        errors++;
      }
    }

    offset += BATCH_SIZE;
    if (response.rows.length < BATCH_SIZE) break;
  }

  return { updated, errors };
}

export async function runPermissionsMigration(): Promise<{
  success: boolean;
  results: Record<string, { updated: number; errors: number }>;
  error?: string;
}> {
  if (!(await isGlobalAdmin())) {
    return { success: false, results: {}, error: "Unauthorized" };
  }

  const { db, teams } = await createAdminClient();

  const results: Record<string, { updated: number; errors: number }> = {};

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
    results[table.id] = await backfillTable(db, teams, table.id, table.deptField);
    console.log(`${table.id}: ${JSON.stringify(results[table.id])}`);
  }

  return { success: true, results };
}
