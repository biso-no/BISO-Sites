/**
 * Move page drafts from page_translations (draft_doc, puck_document,
 * draft_document) into the service-only page_drafts table. Dry-run by default;
 * pass --apply to write. Existing draft rows are never overwritten. Published
 * rows that carry an unpublished title/description get the published values
 * back, and the current values move to the draft.
 *
 * Run it once after deploying the code that reads drafts from page_drafts,
 * while nobody is editing pages, then run a dry run again: it should report
 * nothing to create, clear or restore.
 *
 * Usage (from packages/shared):
 *   bun run migrate:page-drafts            # dry run
 *   bun run migrate:page-drafts -- --apply
 */
import { Client, TablesDB } from "node-appwrite";
import { migratePageDrafts } from "../utils/page-draft-migration";

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
    "Run apply while nobody is editing pages, then run a dry run again: it should report nothing left to do."
  );
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(project)
  .setKey(apiKey);
const db = new TablesDB(client);

const report = await migratePageDrafts(db, { apply });

const verb = apply ? "" : "would be ";
console.log(`page_translations scanned: ${report.scanned}`);
console.log(`Draft rows ${verb}created: ${report.created.length}`);
for (const id of report.created) {
  console.log(`  created draft ${id}`);
}
console.log(`Translation rows ${verb}cleared: ${report.cleared.length}`);
for (const id of report.cleared) {
  console.log(`  cleared ${id}`);
}
console.log(`Titles ${verb}restored: ${report.restoredTitles.length}`);
for (const id of report.restoredTitles) {
  console.log(`  restored title/description ${id}`);
}
if (report.errors.length > 0) {
  console.error(
    "A failed scan writes nothing; a failed row is left untouched and the rest continue. Fix the cause and run again."
  );
  console.error(`ERRORS: ${report.errors.length}`);
  for (const entry of report.errors) {
    console.error(
      `  ${entry.tableId}${entry.rowId ? ` ${entry.rowId}` : ""}: ${entry.message}`
    );
  }
  process.exit(1);
}
