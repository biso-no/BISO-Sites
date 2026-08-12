/**
 * Post-deployment cutover that removes every table-level permission from the
 * general content tables, making them service-only. Consumer visibility lives
 * on individual rows (`read("any")` / member-team reads on published rows) and
 * authoring goes through the admin client behind application authorization.
 *
 * MUST NOT run before the admin build that authors through the admin client is
 * deployed — old session-client writes would stop working. The CLI wrapper is
 * dry-run by default for that reason.
 */

export const GENERAL_CONTENT_TABLES = [
  "events",
  "news",
  "webshop_products",
  "pages",
  "campus_benefits",
  "announcements",
  "documents",
  "content_translations",
  "page_translations",
] as const;

export interface CutoverTable {
  $id: string;
  $permissions: string[];
  enabled: boolean;
  name: string;
  rowSecurity: boolean;
}

export interface CutoverDb {
  getTable(params: { databaseId: string; tableId: string }): Promise<{
    $id: string;
    $permissions: string[];
    enabled: boolean;
    name: string;
    rowSecurity: boolean;
  }>;
  updateTable(params: {
    databaseId: string;
    tableId: string;
    name: string;
    permissions: string[];
    rowSecurity: boolean;
    enabled: boolean;
  }): Promise<unknown>;
}

export interface CutoverReport {
  changed: Array<{ removedPermissions: string[]; tableId: string }>;
  errors: Array<{ message: string; tableId: string }>;
  unchanged: string[];
}

const DATABASE_ID = "app";

export async function cutoverContentPermissions(
  db: CutoverDb,
  options: { apply: boolean }
): Promise<CutoverReport> {
  const report: CutoverReport = { changed: [], errors: [], unchanged: [] };

  for (const tableId of GENERAL_CONTENT_TABLES) {
    try {
      const table = await db.getTable({ databaseId: DATABASE_ID, tableId });
      if (table.$permissions.length === 0) {
        report.unchanged.push(tableId);
        continue;
      }
      if (options.apply) {
        await db.updateTable({
          databaseId: DATABASE_ID,
          tableId,
          // Everything except permissions passes through unchanged.
          enabled: table.enabled,
          name: table.name,
          permissions: [],
          rowSecurity: table.rowSecurity,
        });
      }
      report.changed.push({
        removedPermissions: [...table.$permissions],
        tableId,
      });
    } catch (error) {
      report.errors.push({
        message: error instanceof Error ? error.message : String(error),
        tableId,
      });
    }
  }

  return report;
}
