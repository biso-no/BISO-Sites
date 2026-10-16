/**
 * Removes per-user write grants from every expense row, so a submitter can read
 * their expense and only apps/api (admin key, after ownership checks) can
 * change it. Dry-run by default; pass --apply to write.
 *
 * DO NOT apply before the apps/api build that edits drafts through the admin
 * client is live.
 *
 * Usage (from packages/shared):
 *   bun run lockdown:expense-rows
 *   bun run lockdown:expense-rows -- --apply
 */
import { Client, TablesDB } from "node-appwrite";
import {
  type LockdownDb,
  revokeOwnerWriteGrants,
} from "../utils/row-permission-lockdown";

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
const db = new TablesDB(client) as unknown as LockdownDb;

const report = await revokeOwnerWriteGrants(db, "expense", { apply });

console.log(`Mode: ${apply ? "APPLY" : "dry-run"}`);
console.log(`Expense rows scanned: ${report.scanned}`);
const failedRowIds = new Set(report.errors.map((entry) => entry.rowId));
console.log(
  apply
    ? `Removed write grants on ${report.changed.length - failedRowIds.size} of ${report.changed.length} rows`
    : `Would remove write grants on ${report.changed.length} rows`
);
for (const entry of report.changed) {
  const failed = failedRowIds.has(entry.rowId)
    ? " — FAILED, see errors below"
    : "";
  console.log(`  ${entry.rowId}: ${entry.removed.join(", ")}${failed}`);
}
if (report.errors.length > 0) {
  console.error(`ERRORS: ${report.errors.length}`);
  for (const entry of report.errors) {
    console.error(`  ${entry.rowId}: ${entry.message}`);
  }
  process.exit(1);
}
