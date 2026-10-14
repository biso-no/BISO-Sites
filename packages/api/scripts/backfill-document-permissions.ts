/**
 * Stamp row permissions on governing documents and their version history.
 * Dry-run by default; pass --apply to write. Run once before
 * `cutover:content-permissions`, which removes the table-level grants.
 *
 * Usage (from packages/api):
 *   bun run backfill:document-permissions           # dry run
 *   bun run backfill:document-permissions -- --apply
 */
import { Client, TablesDB } from "node-appwrite";
import { backfillDocumentPermissions } from "../document-permission-backfill";

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
const client = new Client()
  .setEndpoint(endpoint)
  .setProject(project)
  .setKey(apiKey);

const report = await backfillDocumentPermissions(new TablesDB(client), {
  apply,
});

console.log(`Mode: ${apply ? "APPLY" : "dry-run"}`);
console.log(`Already correct: ${report.unchanged.length}`);
console.log(`${apply ? "Updated" : "Would update"}: ${report.changed.length}`);
for (const entry of report.changed) {
  console.log(
    `  ${entry.tableId}/${entry.rowId} -> [${entry.permissions.join(", ")}]`
  );
}
for (const entry of report.errors) {
  console.error(`  FAILED ${entry.tableId}/${entry.rowId}: ${entry.message}`);
}
process.exit(report.errors.length > 0 ? 1 : 0);
