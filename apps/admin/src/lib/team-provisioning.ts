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
 * Recruitment tables carrying applicant PII (cover letters, custom answers,
 * applicant contact details). Every row in these is written with explicit
 * per-row $permissions (`buildVacancyRowPerms` in apps/web), granting read to
 * ops, hr, the owning department team, and the owning campus leadership team.
 * Department teams therefore only need CREATE at the table level — read/update/
 * delete is governed per row, so one department cannot read another department's
 * or campus's applicants. (Resume files live in a fileSecurity bucket and are
 * served only through the admin-gated download route, not via these grants.)
 */
const RECRUITMENT_PII_TABLES = [
  "job_applications",
  "job_application_answers",
] as const;

/**
 * Interview, scheduling and candidate-pool tables that are NOT yet stamped with
 * per-row $permissions (e.g. job_interview_participants and
 * recruitment_booking_tokens are created without a permissions argument), so
 * department teams still require full CRUD at the table level. Tightening these
 * to create-only requires per-row stamping first — see PERMISSIONS_REVIEW.md
 * (finding D, remaining work).
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
 * Grant a dept team full CRUD on all recruitment tables. Campus-level isolation
 * is enforced at the service layer (see `assertRecruitmentApplicationReviewAccess`
 * and `assertInterviewWriteAccess`). The candidate-facing booking endpoint is
 * the only path that operates without a session and validates HMAC tokens
 * directly.
 */
export async function grantTeamRecruitmentAccess(
  teamId: string
): Promise<void> {
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
