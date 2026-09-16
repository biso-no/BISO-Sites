/**
 * Locks profile rows and cleans up student links, in this order:
 *   1. removes per-user write grants from every `user` row;
 *   2. reports `student_id` values no BI (OIDC) identity verifies, and clears
 *      them when run with --apply --clear-unverified-links;
 *   3. reports any student id still held by more than one row.
 * Step 1 runs first so a cleared claim cannot be written back.
 *
 * Dry-run by default. DO NOT apply before the apps/web and apps/api builds that
 * write profiles through the admin client are live, and the app build that
 * saves profiles through PUT /api/profile has shipped.
 *
 * Usage (from packages/shared):
 *   bun run lockdown:profile-rows
 *   bun run lockdown:profile-rows -- --apply --clear-unverified-links
 */
import { Client, TablesDB, Users } from "node-appwrite";
import {
  auditStudentLinks,
  type IdentityLister,
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
const clearUnverified =
  apply && process.argv.includes("--clear-unverified-links");
const client = new Client()
  .setEndpoint(endpoint)
  .setProject(project)
  .setKey(apiKey);
const db = new TablesDB(client) as unknown as LockdownDb;
const users = new Users(client) as unknown as IdentityLister;

const grants = await revokeOwnerWriteGrants(db, "user", { apply });
console.log(`Mode: ${apply ? "APPLY" : "dry-run"}`);
console.log(`Profile rows scanned: ${grants.scanned}`);
const failedRowIds = new Set(grants.errors.map((entry) => entry.rowId));
console.log(
  apply
    ? `Removed write grants on ${grants.changed.length - failedRowIds.size} of ${grants.changed.length} rows`
    : `Would remove write grants on ${grants.changed.length} rows`
);
for (const entry of grants.changed) {
  const failed = failedRowIds.has(entry.rowId)
    ? " — FAILED, see errors below"
    : "";
  console.log(`  ${entry.rowId}: ${entry.removed.join(", ")}${failed}`);
}

const links = await auditStudentLinks(db, users, { clearUnverified });
console.log(`Unverified student links: ${links.unverified.length}`);
for (const entry of links.unverified) {
  console.log(`  ${entry.rowId}: ${entry.studentId}`);
}
console.log(
  clearUnverified
    ? `Cleared: ${links.cleared.length}`
    : "Not cleared (pass --apply --clear-unverified-links to clear)."
);
console.log(
  `Student ids held by more than one verified row: ${links.duplicates.length}`
);
for (const entry of links.duplicates) {
  console.log(`  ${entry.studentId}: ${entry.rowIds.join(", ")}`);
}

const errors = [...grants.errors, ...links.errors];
if (errors.length > 0) {
  console.error(`ERRORS: ${errors.length}`);
  for (const entry of errors) {
    console.error(`  ${entry.rowId}: ${entry.message}`);
  }
  process.exit(1);
}
