/**
 * Repair content ownership and translation relationships against the live
 * Appwrite project. Dry-run by default; pass --apply to perform only the
 * unambiguous updates. Never deletes anything. Prints IDs and counts only.
 *
 * Usage (from packages/api):
 *   bun run repair:content-relationships           # dry run
 *   bun run repair:content-relationships -- --apply
 */
import { Client, TablesDB } from "node-appwrite";
import {
  hasUnsafeFindings,
  repairContentRelationships,
} from "../content-relationship-repair";

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

const report = await repairContentRelationships(db, { apply });

console.log(`Mode: ${apply ? "APPLY" : "dry-run"}`);
console.log(`Already linked: ${report.alreadyLinked}`);
console.log(
  `${apply ? "Linked" : "Would link"} translations: ${report.linked.length}`
);
for (const entry of report.linked) {
  console.log(`  translation ${entry.translationId} -> ${entry.parentId}`);
}
console.log(
  `${apply ? "Linked" : "Would link"} page translations: ${report.pageLinked.length}`
);
for (const entry of report.pageLinked) {
  console.log(`  page_translation ${entry.translationId} -> ${entry.pageId}`);
}
console.log(
  `${apply ? "Rebuilt" : "Would rebuild"} job relations: ${report.jobRelinked.length}`
);
for (const entry of report.jobRelinked) {
  console.log(`  job ${entry.jobId} <- [${entry.translationIds.join(", ")}]`);
}
console.log(
  `${apply ? "Backfilled" : "Would backfill"} ownership: ${report.ownershipBackfills.length}`
);
for (const entry of report.ownershipBackfills) {
  console.log(
    `  ${entry.tableId}/${entry.rowId} ${entry.field} = ${entry.value}`
  );
}

const unsupported = Object.entries(report.unsupportedTypes);
if (unsupported.length > 0) {
  console.log("Unsupported content types (skipped):");
  for (const [type, count] of unsupported) {
    console.log(`  ${type || "(empty)"}: ${count}`);
  }
}

if (report.duplicates.length > 0) {
  console.log(
    `DUPLICATE locale groups (untouched): ${report.duplicates.length}`
  );
  for (const entry of report.duplicates) {
    console.log(
      `  ${entry.contentType}/${entry.contentId} [${entry.locale}]: ${entry.translationIds.join(", ")}`
    );
  }
}
if (report.orphans.length > 0) {
  console.log(`ORPHANS (missing parent, untouched): ${report.orphans.length}`);
  for (const entry of report.orphans) {
    console.log(
      `  ${entry.contentType}/${entry.contentId ?? "(no content_id)"}: ${entry.translationId}`
    );
  }
}
if (report.wrongParents.length > 0) {
  console.log(`WRONG PARENT links (untouched): ${report.wrongParents.length}`);
  for (const entry of report.wrongParents) {
    console.log(
      `  ${entry.contentType} translation ${entry.translationId}: linked ${entry.actualParentId}, metadata ${entry.expectedParentId}`
    );
  }
}
if (report.errors.length > 0) {
  console.log(`ERRORS: ${report.errors.length}`);
  for (const entry of report.errors) {
    console.log(`  ${entry.id}: ${entry.message}`);
  }
}

if (hasUnsafeFindings(report)) {
  console.error(
    "Unsafe findings present — resolve duplicates/orphans/wrong parents explicitly before enforcing uniqueness."
  );
  process.exit(1);
}
console.log("No unsafe findings.");
