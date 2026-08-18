import { Client, Query, TablesDB } from "node-appwrite";
import type { DepartmentRecord } from "./transform/departments";

export function createDb(): TablesDB {
  const endpoint =
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? process.env.APPWRITE_ENDPOINT;
  const project =
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT ?? process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!(endpoint && project && apiKey)) {
    throw new Error(
      "Missing Appwrite configuration: need NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT and APPWRITE_API_KEY"
    );
  }

  return new TablesDB(
    new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey)
  );
}

export async function loadDepartments(
  db: TablesDB
): Promise<DepartmentRecord[]> {
  const response = await db.listRows({
    databaseId: "app",
    queries: [Query.limit(500)],
    tableId: "departments",
  });

  return (response.rows as unknown as DepartmentRecord[]).map((row) => ({
    Id: String(row.Id),
    Name: String(row.Name),
    campus_id: String(row.campus_id),
  }));
}

export async function loadUserIdsByEmail(
  db: TablesDB
): Promise<Map<string, string>> {
  const byEmail = new Map<string, string>();
  let cursor: string | undefined;

  for (;;) {
    const queries = [Query.limit(100)];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    const response = await db.listRows({
      databaseId: "app",
      queries,
      tableId: "user",
    });
    const rows = response.rows as unknown as Array<{
      $id: string;
      email?: string;
    }>;
    for (const row of rows) {
      if (row.email) {
        byEmail.set(row.email.trim().toLowerCase(), row.$id);
      }
    }
    if (rows.length < 100) {
      break;
    }
    cursor = rows.at(-1)?.$id;
  }

  return byEmail;
}
