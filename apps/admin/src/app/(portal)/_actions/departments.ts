"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Departments } from "@repo/api/types/appwrite";
import { requireAuth } from "@/lib/authorization";

export async function listDepartments(opts?: {
  campusId?: string;
  includeInactive?: boolean;
  search?: string;
}) {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const queries: string[] = [Query.orderAsc("Name"), Query.limit(200)];

  // The SOAP sync persists inactive 24SO units (active === false). By default
  // keep them out of generic pickers (e.g. the page editor); the departments
  // management view opts in via includeInactive to show/flag them. Apply the
  // filter in the QUERY (before the 200-row cap) so inactive rows can't displace
  // valid active departments off the first page. active is nullable, so legacy
  // rows with no value (null) are treated as active.
  if (!opts?.includeInactive) {
    queries.push(
      Query.or([Query.equal("active", true), Query.isNull("active")])
    );
  }

  if (opts?.campusId) {
    queries.push(Query.equal("campus_id", opts.campusId));
  } else if (ctx.activeCampusId) {
    // Global admin scoped to a campus via the switcher.
    queries.push(Query.equal("campus_id", [ctx.activeCampusId]));
  } else if (
    ctx.managedCampusIds.length > 0 &&
    !ctx.roles.includes("globaladmin")
  ) {
    queries.push(Query.equal("campus_id", ctx.managedCampusIds));
  }

  if (opts?.search) {
    queries.push(Query.search("Name", opts.search));
  }

  const response = await db.listRows<Departments>(
    "app",
    "departments",
    queries
  );
  return response.rows;
}

async function _getDepartment(id: string) {
  await requireAuth();
  const { db } = await createSessionClient();

  const response = await db.listRows<Departments>("app", "departments", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  return response.rows[0] ?? null;
}
