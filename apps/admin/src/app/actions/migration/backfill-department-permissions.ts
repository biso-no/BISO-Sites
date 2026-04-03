"use server";

/**
 * One-time migration: enable rowSecurity on the departments table and
 * backfill row-level write permissions for each SG-App-Dept-* team.
 *
 * Run order:
 * 1. Call runEnableDepartmentRLS() to enable rowSecurity on the table
 * 2. Call runBackfillDepartmentPermissions() to set per-row permissions
 *
 * Both functions are idempotent and safe to run multiple times.
 */

import { Permission, Query, Role } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { isGlobalAdmin } from "@/lib/authorization";
import { expandDeptName } from "@/lib/campus-constants";

const DATABASE_ID = "app";

/**
 * Step 1: Enable row-level security on the departments table.
 * After this, table-level read("any") still grants public read access,
 * but write operations check row permissions OR the table-level team:admin.
 */
export async function runEnableDepartmentRLS(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!(await isGlobalAdmin())) {
    return { success: false, error: "Unauthorized" };
  }

  const { db } = await createAdminClient();

  try {
    await db.updateTable({
      databaseId: DATABASE_ID,
      tableId: "departments",
      rowSecurity: true,
    });
    console.log("Enabled rowSecurity on departments table.");
    return { success: true };
  } catch (err) {
    console.error("Failed to enable rowSecurity on departments:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Step 2: Iterate all SG-App-Dept-* teams and grant each one update/delete
 * permissions on its matching department row(s) in the departments table.
 *
 * Matching: "SG-App-Dept-Sosialutvalget" → search departments.Name for
 * "Sosialutvalget" (fulltext index), then verify Name.includes(deptName).
 */
export async function runBackfillDepartmentPermissions(): Promise<{
  success: boolean;
  processed: number;
  updated: number;
  errors: number;
  error?: string;
}> {
  if (!(await isGlobalAdmin())) {
    return { success: false, processed: 0, updated: 0, errors: 0, error: "Unauthorized" };
  }

  const { db, teams } = await createAdminClient();
  let processed = 0;
  let updated = 0;
  let errors = 0;

  const allTeams = await teams.list();
  const deptTeams = allTeams.teams.filter((t) =>
    t.name.startsWith("SG-App-Dept-")
  );

  for (const team of deptTeams) {
    const rawDeptName = team.name.replace("SG-App-Dept-", "");
    const deptName = expandDeptName(rawDeptName);
    processed++;

    try {
      const result = await db.listRows<{ Name: string }>(
        DATABASE_ID,
        "departments",
        [Query.search("Name", deptName), Query.limit(10)]
      );

      for (const dept of result.rows) {
        if (!dept.Name.includes(deptName)) continue;

        const existing = (dept.$permissions as string[]) || [];
        const kept = existing.filter((p) => !p.startsWith("read("));
        const newPerms = [
          Permission.read(Role.any()),
          ...kept,
          Permission.update(Role.team(team.$id)),
          Permission.delete(Role.team(team.$id)),
        ];
        const deduped = [...new Set(newPerms)];

        await db.updateRow(DATABASE_ID, "departments", dept.$id, {}, deduped);
        updated++;
        console.log(
          `Updated dept "${dept.Name}" with team ${team.name} (${team.$id})`
        );
      }
    } catch (err) {
      console.error(`Failed to process team ${team.name}:`, err);
      errors++;
    }
  }

  return { success: true, processed, updated, errors };
}
