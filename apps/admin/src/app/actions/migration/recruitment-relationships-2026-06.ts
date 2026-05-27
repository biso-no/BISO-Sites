"use server";

/**
 * Migration: add native Appwrite relationship attributes to the recruitment
 * spine tables (job_applications, job_application_answers, job_interviews,
 * job_interview_participants, job_interview_scorecards, candidate_profiles)
 * and backfill existing rows so each new relationship field is populated
 * from the corresponding plain string-id column.
 *
 * Also backfills row-level write permissions on the `jobs` table so that
 * existing rows created via the admin key become writable by the session
 * client (dept and campus teams).
 *
 * All steps are idempotent and safe to re-run. Use dryRun: true to preview
 * counts before committing. Run as global admin only.
 */

import { type Models, Permission, Query, Role } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Campus, Departments, Jobs } from "@repo/api/types/appwrite";
import { isGlobalAdmin } from "@/lib/authorization";

const DATABASE_ID = "app";

export interface RelationshipMigrationResult {
  dry_run: boolean;
  error?: string;
  errors: number;
  jobs_permissions_updated: number;
  relationships_created: number;
  rows_backfilled: Record<string, number>;
  success: boolean;
}

// ---------------------------------------------------------------------------
// Step 1: create relationship columns (skips if already present)
// ---------------------------------------------------------------------------

async function ensureRelationshipColumns(
  db: Awaited<ReturnType<typeof createAdminClient>>["db"],
  dryRun: boolean
): Promise<number> {
  const relationships = [
    {
      tableId: "job_applications",
      key: "job",
      relatedTableId: "jobs",
      twoWayKey: "applications",
      onDelete: "restrict",
    },
    {
      tableId: "job_applications",
      key: "candidate_profile",
      relatedTableId: "candidate_profiles",
      twoWayKey: "applications",
      onDelete: "setNull",
    },
    {
      tableId: "job_application_answers",
      key: "application",
      relatedTableId: "job_applications",
      twoWayKey: "answers",
      onDelete: "cascade",
    },
    {
      tableId: "job_interviews",
      key: "application",
      relatedTableId: "job_applications",
      twoWayKey: "interviews",
      onDelete: "cascade",
    },
    {
      tableId: "job_interview_participants",
      key: "interview",
      relatedTableId: "job_interviews",
      twoWayKey: "participants",
      onDelete: "cascade",
    },
    {
      tableId: "job_interview_scorecards",
      key: "interview",
      relatedTableId: "job_interviews",
      twoWayKey: "scorecards",
      onDelete: "cascade",
    },
  ] as const;

  let created = 0;

  for (const rel of relationships) {
    try {
      const table = await db.getTable({
        databaseId: DATABASE_ID,
        tableId: rel.tableId,
      });
      const exists = table.columns?.some(
        (col: { key: string }) => col.key === rel.key
      );
      if (exists) {
        console.log(
          `Relationship ${rel.tableId}.${rel.key} already exists, skipping.`
        );
        continue;
      }
      if (dryRun) {
        console.log(`[dry-run] Would create ${rel.tableId}.${rel.key}`);
      } else {
        await db.createRelationshipColumn({
          databaseId: DATABASE_ID,
          tableId: rel.tableId,
          relatedTableId: rel.relatedTableId,
          // biome-ignore lint/suspicious/noExplicitAny: node-appwrite enums not importable here
          type: "manyToOne" as any,
          twoWay: true,
          key: rel.key,
          twoWayKey: rel.twoWayKey,
          // biome-ignore lint/suspicious/noExplicitAny: node-appwrite enums not importable here
          onDelete: rel.onDelete as any,
        });
        console.log(`Created relationship ${rel.tableId}.${rel.key}`);
      }
      created++;
    } catch (err) {
      console.error(`Failed to create ${rel.tableId}.${rel.key}:`, err);
    }
  }

  return created;
}

// ---------------------------------------------------------------------------
// Step 2: backfill relationship fields from existing string-id columns
// ---------------------------------------------------------------------------

async function backfillTable(
  db: Awaited<ReturnType<typeof createAdminClient>>["db"],
  tableId: string,
  relationshipKey: string,
  stringIdKey: string
): Promise<number> {
  let updated = 0;
  let cursor: string | undefined;

  for (let page = 0; page < 500; page++) {
    const queries: string[] = [
      Query.isNull(relationshipKey),
      Query.isNotNull(stringIdKey),
      Query.limit(100),
      Query.orderAsc("$id"),
    ];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }

    const result = await db.listRows<Models.DefaultRow>(
      DATABASE_ID,
      tableId,
      queries
    );
    if (result.rows.length === 0) {
      break;
    }
    cursor = result.rows[result.rows.length - 1].$id;

    for (const row of result.rows) {
      const relatedId = row[stringIdKey] as string | null | undefined;
      if (!relatedId) {
        continue;
      }
      await db.updateRow(DATABASE_ID, tableId, row.$id, {
        [relationshipKey]: relatedId,
      });
      updated++;
    }

    if (result.rows.length < 100) {
      break;
    }
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Step 3: backfill row-level write permissions on jobs
// ---------------------------------------------------------------------------

async function backfillJobsPermissions(
  db: Awaited<ReturnType<typeof createAdminClient>>["db"],
  teams: Awaited<ReturnType<typeof createAdminClient>>["teams"],
  dryRun: boolean
): Promise<number> {
  let updated = 0;

  const allTeams = await teams.list();
  const relevantTeams = allTeams.teams.filter(
    (t) =>
      t.name.startsWith("SG-App-Dept-") || t.name.startsWith("SG-App-Campus-")
  );

  // Build a lookup: campus_id or department_id → team ids that should get perms
  // We iterate all jobs, then for each job find which teams cover its campus/department.
  // To avoid N+1 against teams, we build campus→teams and dept→teams maps first.
  const campusTeams = new Map<string, string[]>();
  const deptTeams = new Map<string, string[]>();

  for (const team of relevantTeams) {
    const isCampus = team.name.startsWith("SG-App-Campus-");
    const isDept = team.name.startsWith("SG-App-Dept-");

    if (isCampus) {
      // Match by campus name in the jobs.campus.name relationship
      const campusName = team.name.replace("SG-App-Campus-", "");
      const campusRows = await db.listRows<Campus>(DATABASE_ID, "campus", [
        Query.equal("name", campusName),
        Query.limit(5),
      ]);
      for (const campus of campusRows.rows) {
        const list = campusTeams.get(campus.$id) ?? [];
        list.push(team.$id);
        campusTeams.set(campus.$id, list);
      }
    } else if (isDept) {
      // Match by department name pattern
      const deptRows = await db.listRows<Departments>(
        DATABASE_ID,
        "departments",
        [Query.limit(500)]
      );
      const suffix = team.name.replace("SG-App-Dept-", "").toLowerCase();
      for (const dept of deptRows.rows) {
        if (dept.Name.toLowerCase().includes(suffix)) {
          const list = deptTeams.get(dept.$id) ?? [];
          list.push(team.$id);
          deptTeams.set(dept.$id, list);
        }
      }
    }
  }

  // Now page through all jobs and set permissions
  let cursor: string | undefined;
  for (let page = 0; page < 500; page++) {
    const queries: string[] = [
      Query.select([
        "$id",
        "$permissions",
        "campus_id",
        "department_id",
        "campus.$id",
        "department.$id",
      ]),
      Query.limit(100),
      Query.orderAsc("$id"),
    ];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }

    const result = await db.listRows<Jobs>(DATABASE_ID, "jobs", queries);
    if (result.rows.length === 0) {
      break;
    }
    cursor = result.rows[result.rows.length - 1].$id;

    for (const job of result.rows) {
      const campusId =
        (job.campus as unknown as { $id: string } | null)?.$id ?? job.campus_id;
      const departmentId =
        (job.department as unknown as { $id: string } | null)?.$id ??
        job.department_id;

      const teamIds: string[] = [];
      if (campusId) {
        teamIds.push(...(campusTeams.get(campusId) ?? []));
      }
      if (departmentId) {
        teamIds.push(...(deptTeams.get(departmentId) ?? []));
      }

      if (teamIds.length === 0) {
        continue;
      }

      const existing = (job.$permissions as string[]) ?? [];
      const hasWritePerms = teamIds.every(
        (tid) =>
          existing.includes(`update("team:${tid}")`) ||
          existing.includes(`update("team:${tid}")`)
      );
      if (hasWritePerms) {
        continue;
      }

      const kept = existing.filter((p) => !p.startsWith("read("));
      const newPerms = [
        Permission.read(Role.any()),
        ...kept,
        ...teamIds.flatMap((tid) => [
          Permission.update(Role.team(tid)),
          Permission.delete(Role.team(tid)),
        ]),
      ];
      const deduped = [...new Set(newPerms)];

      if (!dryRun) {
        await db.updateRow(DATABASE_ID, "jobs", job.$id, {}, deduped);
      }
      updated++;
    }

    if (result.rows.length < 100) {
      break;
    }
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Main exported action
// ---------------------------------------------------------------------------

export async function runRecruitmentRelationshipsMigration(
  options: { dryRun?: boolean } = {}
): Promise<RelationshipMigrationResult> {
  if (!(await isGlobalAdmin())) {
    return {
      dry_run: Boolean(options.dryRun),
      error: "Unauthorized",
      errors: 0,
      jobs_permissions_updated: 0,
      relationships_created: 0,
      rows_backfilled: {},
      success: false,
    };
  }

  const dryRun = Boolean(options.dryRun);
  const { db, teams } = await createAdminClient();
  let errors = 0;

  // 1. Create relationship columns
  const relationshipsCreated = await ensureRelationshipColumns(db, dryRun);

  // 2. Backfill rows — only possible after columns exist (skip in dry-run)
  const rowsBackfilled: Record<string, number> = {};

  if (dryRun) {
    // In dry-run mode just count rows that need backfilling
    for (const [tableId, key, stringKey] of [
      ["job_applications", "job", "job_id"],
      ["job_applications", "candidate_profile", "candidate_profile_id"],
      ["job_application_answers", "application", "application_id"],
      ["job_interviews", "application", "application_id"],
      ["job_interview_participants", "interview", "interview_id"],
      ["job_interview_scorecards", "interview", "interview_id"],
    ]) {
      try {
        const result = await db.listRows(DATABASE_ID, tableId, [
          Query.isNotNull(stringKey),
          Query.limit(1),
        ]);
        rowsBackfilled[`${tableId}.${key}`] = result.total;
      } catch {
        rowsBackfilled[`${tableId}.${key}`] = -1;
      }
    }
  } else {
    const backfills: Array<{
      tableId: string;
      key: string;
      stringKey: string;
    }> = [
      { tableId: "job_applications", key: "job", stringKey: "job_id" },
      {
        tableId: "job_applications",
        key: "candidate_profile",
        stringKey: "candidate_profile_id",
      },
      {
        tableId: "job_application_answers",
        key: "application",
        stringKey: "application_id",
      },
      {
        tableId: "job_interviews",
        key: "application",
        stringKey: "application_id",
      },
      {
        tableId: "job_interview_participants",
        key: "interview",
        stringKey: "interview_id",
      },
      {
        tableId: "job_interview_scorecards",
        key: "interview",
        stringKey: "interview_id",
      },
    ];

    for (const { tableId, key, stringKey } of backfills) {
      try {
        const count = await backfillTable(db, tableId, key, stringKey);
        rowsBackfilled[`${tableId}.${key}`] = count;
        console.log(`Backfilled ${count} rows in ${tableId}.${key}`);
      } catch (err) {
        console.error(`Backfill failed for ${tableId}.${key}:`, err);
        errors++;
      }
    }
  }

  // 3. Backfill jobs row permissions
  let jobsPermissionsUpdated = 0;
  try {
    jobsPermissionsUpdated = await backfillJobsPermissions(db, teams, dryRun);
    console.log(
      `${dryRun ? "[dry-run] Would update" : "Updated"} ${jobsPermissionsUpdated} job rows with team write permissions`
    );
  } catch (err) {
    console.error("Jobs permission backfill failed:", err);
    errors++;
  }

  return {
    dry_run: dryRun,
    errors,
    jobs_permissions_updated: jobsPermissionsUpdated,
    relationships_created: relationshipsCreated,
    rows_backfilled: rowsBackfilled,
    success: errors === 0,
  };
}
