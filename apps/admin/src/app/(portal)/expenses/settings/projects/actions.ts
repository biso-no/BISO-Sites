"use server";

import { type Models, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  Departments,
  FinagoProjects,
  FinagoProjectUsage,
} from "@repo/api/types/appwrite";
import { syncFinagoProjects } from "@repo/shared/utils/finago-project-sync";
import { revalidatePath } from "next/cache";
import { getUserAuthContext } from "@/lib/authorization";
import { ROLES } from "@/lib/roles";
import { logAuditEvent } from "../../../_actions/audit-log";
import type { ExpenseActionResult } from "../../action-result";
import {
  groupProjects,
  type ProjectDepartment,
  type ProjectsView,
  type ProjectView,
} from "./projects-model";

const PAGE_PATH = "/expenses/settings/projects";
const PROJECTS_TABLE = "finago_projects";
const USAGE_TABLE = "finago_project_usage";
const PAGE_SIZE = 500;
/** The admin site times out at 30 s; leave room to save and answer. */
const SYNC_BUDGET_MS = 25_000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

export interface ProjectSyncSummary {
  /** True when time ran out; the nightly run finishes the job. */
  partial: boolean;
  projects: number;
}

async function isGlobalAdmin() {
  const ctx = await getUserAuthContext();
  return ctx?.roles.includes(ROLES.GLOBAL_ADMIN) ? ctx : null;
}

async function listAll<T extends Models.Row>(
  db: AdminDb,
  table: string,
  queries: string[]
): Promise<T[]> {
  const all: T[] = [];
  for (;;) {
    const { rows } = await db.listRows<T>("app", table, [
      ...queries,
      Query.limit(PAGE_SIZE),
      Query.offset(all.length),
    ]);
    all.push(...rows);
    if (rows.length < PAGE_SIZE) {
      return all;
    }
  }
}

const day = (value: string | null): string | null =>
  value ? value.slice(0, 10) : null;

/** Active projects with the departments that used them. Global admins only. */
export async function getProjectsView(): Promise<ProjectsView> {
  if (!(await isGlobalAdmin())) {
    throw new Error("Forbidden: only global admins can see projects");
  }
  const { db } = await createAdminClient();
  const [projects, usage, departments] = await Promise.all([
    listAll<FinagoProjects>(db, PROJECTS_TABLE, [Query.equal("active", true)]),
    listAll<FinagoProjectUsage>(db, USAGE_TABLE, []),
    listAll<Departments>(db, "departments", [Query.select(["$id", "Name"])]),
  ]);

  const names = new Map(departments.map((d) => [d.$id, d.Name]));
  const usedBy = new Map<string, ProjectDepartment[]>();
  const used = new Map<string, ProjectDepartment>();
  for (const row of usage) {
    const department = {
      id: row.department_id,
      name: names.get(row.department_id) ?? row.department_id,
    };
    usedBy.set(row.project_id, [
      ...(usedBy.get(row.project_id) ?? []),
      department,
    ]);
    used.set(department.id, department);
  }

  const views: ProjectView[] = projects.map((row) => ({
    departments: (usedBy.get(row.project_id) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
    eventDate: day(row.event_date),
    firstLineDate: day(row.first_line_date),
    id: row.$id,
    lastLineDate: day(row.last_line_date),
    name: row.name,
    peakDate: day(row.peak_date),
    series: row.series,
    year: row.year,
  }));

  const synced = projects
    .map((row) => row.synced_at)
    .filter((value): value is string => Boolean(value))
    .sort();

  return {
    departments: [...used.values()].sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
    groups: groupProjects(views),
    lastSyncedAt: synced.at(-1) ?? null,
  };
}

/**
 * Pulls projects and their booking lines from Finago. Runs within the page
 * time limit; a partial run says so and the nightly sync finishes it. Audited.
 */
export async function syncProjectsFromFinago(): Promise<
  ExpenseActionResult<ProjectSyncSummary>
> {
  const ctx = await isGlobalAdmin();
  if (!ctx) {
    return { error: "forbidden" };
  }
  try {
    const { getProjects, listCostLines } = await import(
      "@repo/connectors/24sevenoffice"
    );
    const { db } = await createAdminClient();
    const result = await syncFinagoProjects(db, {
      budgetMs: SYNC_BUDGET_MS,
      getProjects,
      listCostLines,
      now: new Date(),
    });
    await logAuditEvent(ctx, "finago_projects.sync", {
      payload: { partial: result.partial, projects: result.projects },
      resourceType: PROJECTS_TABLE,
    });
    revalidatePath(PAGE_PATH);
    return { data: { partial: result.partial, projects: result.projects } };
  } catch (error) {
    console.error("[finago-projects] Sync failed:", error);
    return { error: "failed" };
  }
}

function isRealDay(value: string): boolean {
  const match = ISO_DAY.exec(value);
  if (!match) {
    return false;
  }
  const [, year, month, date] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, date));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === date
  );
}

/**
 * Sets finance's event date (YYYY-MM-DD) for a project, or clears it with
 * null. Finance's date wins over every other source. Audited.
 */
export async function setProjectEventDate(
  projectId: string,
  date: string | null
): Promise<ExpenseActionResult<null>> {
  const ctx = await isGlobalAdmin();
  if (!ctx) {
    return { error: "forbidden" };
  }
  if (date !== null && !isRealDay(date)) {
    return { error: "invalid_date" };
  }
  try {
    const { db } = await createAdminClient();
    const eventDate = date === null ? null : `${date}T00:00:00.000Z`;
    await db.updateRow("app", PROJECTS_TABLE, projectId, {
      event_date: eventDate,
    });
    await logAuditEvent(ctx, "finago_projects.event_date", {
      payload: { event_date: eventDate },
      resourceId: projectId,
      resourceType: PROJECTS_TABLE,
    });
    revalidatePath(PAGE_PATH);
    return { data: null };
  } catch (error) {
    console.error("[finago-projects] Event date save failed:", error);
    return { error: "failed" };
  }
}
