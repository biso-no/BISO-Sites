/**
 * Clears the legacy public `campus_benefits.redemption_value` column. The
 * website reads codes from the private `benefit_codes` table, and the admin
 * no longer copies codes into the public row.
 *
 * For every campus_benefits row with a non-empty redemption_value:
 *   - copy: if benefit_codes has no row for it, upsert {benefit_id, value}
 *     with `[]` permissions (an existing private row is never overwritten);
 *   - clear: update the row with redemption_value null.
 *
 * Dry run by default (reads only). `--apply` writes. Output is counts only,
 * never a code value. Safe to re-run.
 *
 * Usage (from packages/shared):
 *   bun run clear:legacy-benefit-codes            # dry run
 *   bun run clear:legacy-benefit-codes --apply
 */
import { AppwriteException, Client, Query, TablesDB } from "node-appwrite";
import {
  formatLegacyCodeClearPlan,
  formatLegacyCodeClearResult,
  type LegacyCodeRow,
  planLegacyCodeClear,
} from "../utils/legacy-benefit-codes";

const DATABASE_ID = "app";
const BENEFITS_TABLE = "campus_benefits";
const CODES_TABLE = "benefit_codes";
const PAGE_SIZE = 100;
const NOT_FOUND = 404;

const endpoint =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? process.env.APPWRITE_ENDPOINT;
const project =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT ?? process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!(endpoint && project && apiKey)) {
  console.error(
    "Missing Appwrite configuration: need NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT, and APPWRITE_API_KEY."
  );
  process.exit(2);
}

const db = new TablesDB(
  new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey)
);

const args = process.argv.slice(2).filter((arg) => arg !== "--");

async function listAll<T extends { $id: string }>(
  tableId: string
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | null = null;
  while (true) {
    const queries = [Query.limit(PAGE_SIZE)];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    const { rows } = await db.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries,
    });
    all.push(...(rows as unknown as T[]));
    const last = rows.at(-1);
    if (rows.length < PAGE_SIZE || !last) {
      return all;
    }
    cursor = last.$id;
  }
}

async function main(): Promise<void> {
  const benefits = await listAll<LegacyCodeRow>(BENEFITS_TABLE);
  const codes = await listAll<{ $id: string; value?: string }>(CODES_TABLE);
  const valueById = new Map(
    benefits.map((row) => [row.$id, row.redemption_value?.trim() ?? ""])
  );
  const plan = planLegacyCodeClear(
    benefits,
    new Set(codes.map((code) => code.$id))
  );

  if (!args.includes("--apply")) {
    for (const line of formatLegacyCodeClearPlan(plan, benefits.length)) {
      console.log(line);
    }
    return;
  }

  for (const id of plan.copy) {
    await db.upsertRow({
      databaseId: DATABASE_ID,
      tableId: CODES_TABLE,
      rowId: id,
      data: { benefit_id: id, value: valueById.get(id) },
      permissions: [],
    });
  }
  let cleared = 0;
  for (const id of plan.clear) {
    try {
      await db.updateRow({
        databaseId: DATABASE_ID,
        tableId: BENEFITS_TABLE,
        rowId: id,
        data: { redemption_value: null },
      });
      cleared += 1;
    } catch (error) {
      if (!(error instanceof AppwriteException && error.code === NOT_FOUND)) {
        throw error;
      }
    }
  }
  for (const line of formatLegacyCodeClearResult({
    cleared,
    copied: plan.copy.length,
  })) {
    console.log(line);
  }
}

try {
  await main();
} catch (error) {
  // The message is the SDK's; it never carries row values.
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
