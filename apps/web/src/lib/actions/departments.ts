import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";

export async function getDepartments() {
  const { db } = await createSessionClient();
  const departments = await db.listRows("app", "departments", [Query.equal("active", true)]);
  return departments.rows;
}