import { Client, Query, TablesDB } from "node-appwrite";
import { type ExistingTranslation, translationKey } from "./load/index";
import type { DepartmentRecord } from "./transform/departments";
import type { ContentLocale } from "./types";

/**
 * Appwrite's listRows caps at 500 per page (loadDepartments has always relied
 * on it). Paging the user table 100 at a time meant ~100 sequential round
 * trips before transform could start; 500 cuts that fivefold. The loops below
 * derive their stop condition from this constant — hardcoding the number in
 * both places is how a page-size change silently truncates a listing.
 */
const PAGE_SIZE = 500;

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
    queries: [Query.limit(PAGE_SIZE)],
    tableId: "departments",
  });

  return (response.rows as unknown as DepartmentRecord[]).map((row) => ({
    Id: String(row.Id),
    Name: String(row.Name),
    campus_id: String(row.campus_id),
  }));
}

/**
 * Maps every existing `content_translations` row for a given content type,
 * keyed by translationKey(content_id, locale). Serves two purposes:
 *
 * 1. `content_translations` has a unique index on
 *    (content_type, content_id, locale), so re-running `load --apply` without
 *    threading each row's `$id` back in would collide on that index for every
 *    row that already landed — see buildTranslationRows() in ./load/index.ts.
 * 2. The row text comes back too, so a resumed run can reuse a translation it
 *    already generated instead of paying for another OpenAI call — see
 *    existingTargetContent().
 */
export async function loadContentTranslations(
  db: TablesDB,
  contentType: string
): Promise<Map<string, ExistingTranslation>> {
  const translations = new Map<string, ExistingTranslation>();
  let cursor: string | undefined;

  for (;;) {
    const queries = [
      Query.equal("content_type", contentType),
      Query.limit(PAGE_SIZE),
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
      description: string | null;
      locale: ContentLocale;
      short_description: string | null;
      title: string | null;
    }>;
    for (const row of rows) {
      translations.set(translationKey(row.content_id, row.locale), {
        $id: row.$id,
        description: row.description ?? "",
        locale: row.locale,
        short_description: row.short_description,
        title: row.title ?? "",
      });
    }
    if (rows.length < PAGE_SIZE) {
      break;
    }
    cursor = rows.at(-1)?.$id;
  }

  return translations;
}

export async function loadUserIdsByEmail(
  db: TablesDB
): Promise<Map<string, string>> {
  const byEmail = new Map<string, string>();
  let cursor: string | undefined;

  for (;;) {
    const queries = [Query.limit(PAGE_SIZE)];
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
    if (rows.length < PAGE_SIZE) {
      break;
    }
    cursor = rows.at(-1)?.$id;
  }

  return byEmail;
}
