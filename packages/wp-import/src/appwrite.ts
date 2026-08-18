import { Client, Query, TablesDB } from "node-appwrite";
import { translationKey } from "./load/index";
import type { DepartmentRecord } from "./transform/departments";

export function clientFromEnv(): Client {
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

  return new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey);
}

export function createDb(): TablesDB {
  return new TablesDB(clientFromEnv());
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

/**
 * Maps every existing `content_translations` row for a given content type to
 * its `$id`, keyed by translationKey(content_id, locale). `content_translations`
 * has a unique index on (content_type, content_id, locale), so re-running
 * `load --apply` without this would collide on that index for every row that
 * already landed — see buildTranslationRows() in ./load/index.ts.
 */
export async function loadContentTranslationIds(
  db: TablesDB,
  contentType: string
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  let cursor: string | undefined;

  for (;;) {
    const queries = [
      Query.equal("content_type", contentType),
      Query.limit(100),
    ];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    const response = await db.listRows({
      databaseId: "app",
      queries,
      tableId: "content_translations",
    });
    const rows = response.rows as unknown as Array<{
      $id: string;
      content_id: string;
      locale: string;
    }>;
    for (const row of rows) {
      ids.set(translationKey(row.content_id, row.locale), row.$id);
    }
    if (rows.length < 100) {
      break;
    }
    cursor = rows.at(-1)?.$id;
  }

  return ids;
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
