/**
 * Stamp the account's sign-in email on `user` profile rows that have none.
 * Dry-run by default; pass --apply to write. Safe to re-run: rows that already
 * have an email are never touched.
 *
 * Usage (from packages/api):
 *   bun run backfill:profile-emails           # dry run
 *   bun run backfill:profile-emails -- --apply
 */
import { Client, TablesDB, Users } from "node-appwrite";
import { backfillProfileEmails } from "../profile-email-backfill";

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

const report = await backfillProfileEmails(
  new TablesDB(client),
  new Users(client),
  { apply }
);

const skippedBy = (reason: string) =>
  report.skipped.filter((entry) => entry.reason === reason).length;

console.log(`Mode: ${apply ? "APPLY" : "dry-run"}`);
console.log(`Profile rows checked: ${report.checked}`);
console.log(`Already had an email: ${report.alreadySet}`);
console.log(`${apply ? "Stamped" : "Would stamp"}: ${report.stamped.length}`);
console.log(
  `Skipped: ${report.skipped.length} (no account ${skippedBy("no_account")}, account without email ${skippedBy("no_account_email")}, too long ${skippedBy("too_long")})`
);
for (const entry of report.skipped) {
  console.log(`  skipped ${entry.rowId}: ${entry.reason}`);
}
for (const entry of report.errors) {
  console.error(`  FAILED ${entry.rowId}: ${entry.message}`);
}
process.exit(report.errors.length > 0 ? 1 : 0);
