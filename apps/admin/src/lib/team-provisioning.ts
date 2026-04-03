"use server";

import { Permission, Query, Role } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { Departments } from "@repo/api/types/appwrite";
import { expandDeptName } from "./campus-constants";

const DATABASE_ID = "app";
/**
 * Tables that SG-App teams need create/update/delete access on.
 *
 * Includes the main content tables AND their child translation tables so
 * multilingual saves work without permission errors. Translation tables
 * use rowSecurity: false, so table-level team permissions are sufficient.
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
 * Grant a team create + update + delete permission on all content tables.
 *
 * - create: table-level only (rows don't exist yet at create time)
 * - update/delete: added at table level so the team can act on rows;
 *   row-level permissions (set by buildContentPermissions) further restrict
 *   WHICH rows each team can touch when rowSecurity is enabled.
 *
 * Uses TablesDB.getTable() / updateTable() to patch $permissions without
 * disturbing other existing entries.
 */
export async function grantTeamContentAccess(teamId: string): Promise<void> {
  const { db } = await createAdminClient();

  const newPerms = [
    `create("team:${teamId}")`,
    `update("team:${teamId}")`,
    `delete("team:${teamId}")`,
  ];

  for (const tableId of CONTENT_TABLES) {
    try {
      const table = await db.getTable({ databaseId: DATABASE_ID, tableId });
      const missing = newPerms.filter(
        (p) => !table.$permissions.includes(p)
      );

      if (missing.length > 0) {
        await db.updateTable({
          databaseId: DATABASE_ID,
          tableId,
          permissions: [...table.$permissions, ...missing],
        });
        console.log(
          `Granted [${missing.join(", ")}] on ${tableId} to team ${teamId}`
        );
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
      if (!dept.Name.includes(deptName)) continue;

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
