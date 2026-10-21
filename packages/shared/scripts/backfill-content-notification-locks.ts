/**
 * Create `skipped` notification locks for every event, news item and job that
 * is already published, so the content notifier never announces content that
 * predates launch. Dry-run by default; pass --apply to write. Safe to re-run:
 * existing locks are never modified.
 *
 * Usage (from packages/shared):
 *   bun run backfill:notification-locks           # dry run, prints counts
 *   bun run backfill:notification-locks -- --apply
 */
import { AppwriteException, Client, Query, TablesDB } from "node-appwrite";
import {
  type BackfillRow,
  backfillLocks,
} from "../utils/content-notification-backfill";

const DATABASE_ID = "app";
const LOCK_TABLE_ID = "content_notifications";
const PAGE_SIZE = 100;
const CONFLICT = 409;
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

const apply = process.argv.includes("--apply");
const db = new TablesDB(
  new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey)
);

const result = await backfillLocks(
  {
    async listPublished(table, cursor) {
      const queries = [
        Query.equal("status", "published"),
        Query.select(["$id", "campus_id"]),
        Query.limit(PAGE_SIZE),
      ];
      if (cursor) {
        queries.push(Query.cursorAfter(cursor));
      }
      const { rows: fetched } = await db.listRows({
        databaseId: DATABASE_ID,
        tableId: table,
        queries,
      });
      const rows: BackfillRow[] = fetched.map((row) => ({
        $id: row.$id,
        campus_id: typeof row.campus_id === "string" ? row.campus_id : null,
      }));
      const last = rows.at(-1);
      return {
        rows,
        nextCursor: rows.length === PAGE_SIZE && last ? last.$id : null,
      };
    },
    async lockExists(lockId) {
      try {
        await db.getRow({
          databaseId: DATABASE_ID,
          tableId: LOCK_TABLE_ID,
          rowId: lockId,
        });
        return true;
      } catch (error) {
        if (error instanceof AppwriteException && error.code === NOT_FOUND) {
          return false;
        }
        throw error;
      }
    },
    async createLock(lockId, data) {
      try {
        await db.createRow({
          databaseId: DATABASE_ID,
          tableId: LOCK_TABLE_ID,
          rowId: lockId,
          data,
        });
        return "created";
      } catch (error) {
        if (error instanceof AppwriteException && error.code === CONFLICT) {
          return "exists";
        }
        throw error;
      }
    },
  },
  { dryRun: !apply }
);

console.log(`Mode: ${apply ? "APPLY" : "dry-run"}`);
const verb = apply ? "created" : "would create";
for (const [table, counts] of Object.entries(result.byTable)) {
  console.log(
    `${table}: ${verb} ${counts.created}, already existed ${counts.existing}`
  );
}
console.log(
  `Total: ${verb} ${result.created}, already existed ${result.existing}`
);
