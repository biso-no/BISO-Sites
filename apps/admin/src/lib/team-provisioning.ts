"use server";

import { Permission, Query, Role } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Departments } from "@repo/api/types/appwrite";
import { expandDeptName } from "./campus-constants";

const DATABASE_ID = "app";

/**
 * All content and translation tables that SG-App-Dept-* teams need create
 * access on. Campus teams (SG-App-Campus-*) are never granted table-level
 * permissions — they exist only for authorization context.
 *
 * Both content tables (rowSecurity: true) and translation tables
 * (rowSecurity: true) get create-only here; update/delete is controlled
 * entirely at the row level via $permissions set at insert time.
 */
const CONTENT_TABLES = [
  "events",
  "jobs",
  "news",
  "webshop_products",
  "pages",
  "content_translations",
  "page_translations",
] as const;

/**
 * Grant a dept team create-only permission on all content and translation tables.
 *
 * Only called for SG-App-Dept-* teams (never Campus teams).
 * Row-level update/delete is assigned at insert time via buildContentPermissions.
 */
export async function grantTeamContentAccess(teamId: string): Promise<void> {
  const { db } = await createAdminClient();

  const createPerm = `create("team:${teamId}")`;

  for (const tableId of CONTENT_TABLES) {
    try {
      const table = await db.getTable({ databaseId: DATABASE_ID, tableId });

      if (!table.$permissions.includes(createPerm)) {
        await db.updateTable({
          databaseId: DATABASE_ID,
          tableId,
          permissions: [...table.$permissions, createPerm],
        });
        console.log(`Granted create on ${tableId} to team ${teamId}`);
      }
    } catch (err) {
      console.error(
        `Failed to grant content access for team ${teamId} on table ${tableId}:`,
        err
      );
    }
  }
}

/**
 * Grant a department team write access on its matching department row(s).
 * Called when a new SG-App-Dept-* team is created during M365 sync.
 *
 * deptName is the raw suffix after "SG-App-Dept-" (e.g. "OperationsUnit").
 * It is first expanded to a spaced form ("Operations Unit") to match the
 * campus-prefixed Name values stored in the DB ("OSL Operations Unit").
 *
 * Existing read("any") permission is preserved on each row.
 */
export async function grantDeptTeamAccess(
  teamId: string,
  rawDeptName: string
): Promise<void> {
  const deptName = expandDeptName(rawDeptName);
  const { db } = await createAdminClient();

  try {
    const result = await db.listRows<Departments>(DATABASE_ID, "departments", [
      Query.search("Name", deptName),
      Query.limit(10),
    ]);

    if (result.rows.length === 0) {
      console.warn(
        `grantDeptTeamAccess: no departments found for "${deptName}" (raw: "${rawDeptName}")`
      );
      return;
    }

    for (const dept of result.rows) {
      if (!dept.Name.includes(deptName)) {
        continue;
      }

      const existing = (dept.$permissions as string[]) || [];
      const kept = existing.filter((p) => !p.startsWith("read("));
      const newPerms = [
        Permission.read(Role.any()),
        ...kept,
        Permission.update(Role.team(teamId)),
        Permission.delete(Role.team(teamId)),
      ];
      const deduped = [...new Set(newPerms)];

      await db.updateRow(DATABASE_ID, "departments", dept.$id, {}, deduped);
      console.log(
        `Granted update/delete on dept "${dept.Name}" to team ${teamId}`
      );
    }
  } catch (err) {
    console.error(
      `Failed to grant dept access for team ${teamId} ("${deptName}"):`,
      err
    );
  }
}
