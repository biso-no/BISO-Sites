/**
 * Rename accounts, profile rows and public profiles that carry BI's directory
 * name ("(Student) Heien, Markus") to "Markus Heien". Dry-run by default; pass
 * --apply to write. Safe to re-run: names not in BI's format are never touched.
 *
 * Usage (from packages/shared):
 *   bun run backfill:bi-names           # dry run, lists every rename
 *   bun run backfill:bi-names -- --apply
 */
import { Client, TablesDB, Users } from "node-appwrite";
import { backfillBiNames, type NameChange } from "../utils/bi-name-backfill";

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

const report = await backfillBiNames(new TablesDB(client), new Users(client), {
  apply,
});

const verb = apply ? "Renamed" : "Would rename";
const section = (label: string, checked: number, changes: NameChange[]) => {
  console.log(
    `${label}: ${checked} checked, ${verb.toLowerCase()} ${changes.length}`
  );
  for (const change of changes) {
    console.log(`  ${change.id}: "${change.from}" -> "${change.to}"`);
  }
};

console.log(`Mode: ${apply ? "APPLY" : "dry-run"}`);
section("Accounts", report.accounts.checked, report.accounts.renamed);
section("Profile rows", report.profiles.checked, report.profiles.renamed);
for (const entry of report.profiles.skipped) {
  console.log(`  skipped ${entry.id}: ${entry.reason}`);
}
section(
  "Public profiles",
  report.publicProfiles.checked,
  report.publicProfiles.renamed
);
for (const entry of report.errors) {
  console.error(`  FAILED ${entry.scope} ${entry.id}: ${entry.message}`);
}
process.exit(report.errors.length > 0 ? 1 : 0);
