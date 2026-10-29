/**
 * Reconcile the read permissions on existing rows of pages, page_translations,
 * campus_benefits, events and content_translations with what the current code
 * writes. news, webshop_products, jobs and departments are read only for the
 * status of the parents that translations follow. Dry-run by default; pass
 * --apply to write. Only read(...) entries change; update/delete entries on a
 * row are kept. Each row is re-checked just before it is written.
 *
 * Run it after deploying the new code and before pushing the table permission
 * change. Never run it together with the content-permission cutover.
 *
 * Usage (from packages/shared):
 *   bun run reconcile:row-permissions            # dry run
 *   bun run reconcile:row-permissions -- --apply
 */
import { Client, TablesDB } from "node-appwrite";
import { reconcileRowPermissions } from "../utils/row-permission-reconcile";

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
console.log(`Mode: ${apply ? "APPLY" : "dry-run"}`);
console.log(`Endpoint: ${endpoint}`);
console.log(`Project: ${project}`);
if (apply) {
  console.log(
    "Run apply while nobody is editing content, then run a dry run again: it should report 0 changes."
  );
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(project)
  .setKey(apiKey);
const db = new TablesDB(client);

const report = await reconcileRowPermissions(db, { apply });

const STATUS_ONLY = new Set([
  "news",
  "webshop_products",
  "jobs",
  "departments",
]);
for (const [tableId, scanned] of Object.entries(report.scanned)) {
  if (STATUS_ONLY.has(tableId)) {
    console.log(`${tableId}: ${scanned} read for parent status`);
    continue;
  }
  const changed = report.changes.filter((c) => c.tableId === tableId).length;
  console.log(
    `${tableId}: scanned ${scanned}, ${apply ? "changed" : "would change"} ${changed}`
  );
}
for (const change of report.changes) {
  console.log(
    `  ${change.tableId} ${change.rowId}: [${change.before.join(", ")}] → [${change.after.join(", ")}]`
  );
}
for (const entry of report.skipped) {
  console.log(`  SKIPPED ${entry.tableId} ${entry.rowId}: ${entry.reason}`);
}
for (const entry of report.revised) {
  console.log(
    `  REVISED ${entry.tableId} ${entry.rowId}: changed since the scan, wrote [${entry.after.join(", ")}] instead of [${entry.planned.join(", ")}]`
  );
}
if (report.errors.length > 0) {
  if (apply && report.scanFailed) {
    console.error("A scan failed, so nothing was written.");
  } else if (apply) {
    console.error(
      `${report.errors.length} update(s) failed; all other planned changes were written.`
    );
  }
  console.error(`ERRORS: ${report.errors.length}`);
  for (const entry of report.errors) {
    console.error(
      `  ${entry.tableId}${entry.rowId ? ` ${entry.rowId}` : ""}: ${entry.message}`
    );
  }
  process.exit(1);
}
