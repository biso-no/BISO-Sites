import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";

export async function getDepartments({ campusId }: { campusId?: string }) {
  const { db } = await createSessionClient();
  const queries = [Query.equal("active", true)];
  if (campusId && campusId !== "all") {
    queries.push(Query.equal("campus_id", campusId));
  }
  const departments = await db.listRows("app", "departments", queries);
  return departments.rows;
}