"use server";

import { Permission, Query, Role } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Departments } from "@repo/api/types/appwrite";
import { expandDeptName } from "./campus-constants";

const DATABASE_ID = "app";

// Recruitment is HR-exclusive: only the HR department team is provisioned
// recruitment table access. Matches RECRUITMENT_STAFF_TEAMS in @repo/shared.
const HR_TEAM_ID = "sg-app-dept-hr";

/**
 * All content and translation tables that SG-App-Dept-* teams need create
 * access on. Campus teams (SG-App-Campus-*) are never granted table-level
 * permissions — they exist only for authorization context.
 *
 * Both content tables (rowSecurity: true) and translation tables
 * (rowSecurity: true) get create-only here; update/delete is controlled
 * entirely at the row level via $permissions set at insert time.
 *
 * `jobs` is intentionally excluded: recruitment is HR-exclusive, so job
 * table access is provisioned only to the HR team via
 * `grantTeamRecruitmentAccess` — it is not part of the general dept content
 * grant. (HR already holds table-level create on `jobs` in
 * `packages/api/appwrite.config.json`, and job rows are written via the admin
 * client which bypasses row security.)
 */
const CONTENT_TABLES = [
  "events",
  "news",
  "webshop_products",
  "pages",
  "content_translations",
  "page_translations",
] as const;

/**
 * Recruitment tables carrying applicant PII (cover letters, custom answers,
 * applicant contact details). Recruitment is HR-exclusive: of the SG-App-Dept-*
 * teams, only the HR team (`sg-app-dept-hr`) ever reaches the grant below — see
 * the early return in `grantTeamRecruitmentAccess`. Application/answer/candidate
 * rows are written with `buildRecruitmentStaffRowPermissions()` (from
 * `@repo/shared`), granting read/update/delete to admin + HR only. The HR team
 * therefore only needs CREATE at the table level here — read/update/delete is
 * governed per row by those grants. Campus and owning-department teams are
 * intentionally excluded: campus is scoping applied in app code, never a
 * permission. (Resume files live in a fileSecurity bucket and are served only
 * through the admin-gated download route, not via these grants.)
 */
const RECRUITMENT_PII_TABLES = [
  "job_applications",
  "job_application_answers",
] as const;

/**
 * Interview, scheduling and candidate-pool tables that are NOT yet stamped with
 * per-row $permissions (e.g. job_interview_participants and
 * recruitment_booking_tokens are created without a permissions argument), so
 * the HR team still requires full CRUD at the table level. As with the PII
 * tables above, this grant only ever runs for the HR team (`sg-app-dept-hr`);
 * recruitment is HR-exclusive, so admin + HR are the only teams with recruitment
 * table access (admin holds its grants in `packages/api/appwrite.config.json`).
 * Tightening these to create-only requires per-row stamping first — see
 * PERMISSIONS_REVIEW.md (finding D, remaining work).
 */
const RECRUITMENT_SHARED_TABLES = [
  "job_interviews",
  "job_interview_participants",
  "job_interview_scorecards",
  "candidate_profiles",
  "recruitment_booking_tokens",
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
        console.info(`Granted create on ${tableId} to team ${teamId}`);
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
 * Provision recruitment table access for the HR team only. Recruitment is
 * HR-exclusive, so this is a no-op for every non-HR team — even though
 * `m365-sync.ts` calls it for every SG-App-Dept-* team at creation time. Only
 * the admin team and the HR department team (`sg-app-dept-hr`) get recruitment
 * table access; admin holds its table-level grants in
 * `packages/api/appwrite.config.json`, and application/answer/candidate rows are
 * written with `buildRecruitmentStaffRowPermissions()` (from `@repo/shared`)
 * granting admin + HR only. Campus and owning-department teams are intentionally
 * excluded — campus is scoping applied in app code, never a permission.
 */
export async function grantTeamRecruitmentAccess(
  teamId: string
): Promise<void> {
  if (teamId !== HR_TEAM_ID) {
    return;
  }

  const { db } = await createAdminClient();
  const role = Role.team(teamId);
  const createOnly = [Permission.create(role)];
  const fullCrud = [
    Permission.read(role),
    Permission.create(role),
    Permission.update(role),
    Permission.delete(role),
  ];

  const grant = async (tableId: string, perms: string[]): Promise<void> => {
    try {
      const table = await db.getTable({ databaseId: DATABASE_ID, tableId });
      const existing = table.$permissions as string[];
      const next = [...new Set([...existing, ...perms])];

      if (next.length !== existing.length) {
        await db.updateTable({
          databaseId: DATABASE_ID,
          tableId,
          permissions: next,
        });
        console.info(
          `Granted recruitment access on ${tableId} to team ${teamId}`
        );
      }
    } catch (err) {
      console.error(
        `Failed to grant recruitment access for team ${teamId} on table ${tableId}:`,
        err
      );
    }
  };

  // PII tables: create-only (read/update/delete governed per row).
  for (const tableId of RECRUITMENT_PII_TABLES) {
    await grant(tableId, createOnly);
  }
  // Interview/scheduling/pool tables: full CRUD until they are stamped per row.
  for (const tableId of RECRUITMENT_SHARED_TABLES) {
    await grant(tableId, fullCrud);
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
      console.info(
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
