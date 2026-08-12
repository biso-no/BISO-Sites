/**
 * Remove table-level permissions from the nine general content tables, making
 * authoring service-only. Dry-run by default; pass --apply to write.
 *
 * DO NOT apply before the admin build that authors through the admin client is
 * live — old session-client mutations would stop working.
 *
 * Usage (from packages/api):
 *   bun run cutover:content-permissions           # dry run
 *   bun run cutover:content-permissions -- --apply
 */
import { Client, TablesDB } from "node-appwrite";
import { cutoverContentPermissions } from "../content-permission-cutover";

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
const db = new TablesDB(client);

const report = await cutoverContentPermissions(db, { apply });

console.log(`Mode: ${apply ? "APPLY" : "dry-run"}`);
console.log(`Already service-only: ${report.unchanged.length}`);
for (const tableId of report.unchanged) {
  console.log(`  ${tableId}`);
}
console.log(
  `${apply ? "Cleared" : "Would clear"} table permissions: ${report.changed.length}`
);
for (const entry of report.changed) {
  console.log(`  ${entry.tableId}:`);
  for (const permission of entry.removedPermissions) {
    console.log(`    - ${permission}`);
  }
}
if (report.errors.length > 0) {
  console.error(`ERRORS: ${report.errors.length}`);
  for (const entry of report.errors) {
    console.error(`  ${entry.tableId}: ${entry.message}`);
  }
  process.exit(1);
}
