/**
 * Set the `interview` relationship on interview scorecards that only have
 * `interview_id`, so the board and the retention cleanup can follow it.
 * Dry-run by default; pass --apply to write. Scorecards whose interview no
 * longer exists are listed as orphans and are never changed or deleted.
 *
 * Usage (from packages/shared):
 *   bun run backfill:scorecard-interviews            # dry run
 *   bun run backfill:scorecard-interviews -- --apply
 */
import { Client, TablesDB } from "node-appwrite";
import { backfillScorecardInterviews } from "../utils/scorecard-interview-backfill";

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

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(project)
  .setKey(apiKey);
const db = new TablesDB(client);

const report = await backfillScorecardInterviews(db, { apply });

console.log(
  `job_interviews: ${report.scanned.interviews} read; job_interview_scorecards: scanned ${report.scanned.scorecards}, ${apply ? "linked" : "would link"} ${apply ? report.applied : report.links.length}`
);
for (const link of report.links) {
  console.log(
    `  scorecard ${link.scorecardId} -> interview ${link.interviewId}`
  );
}
if (report.orphans.length > 0) {
  console.log(
    `ORPHANS (interview not found; delete by hand): ${report.orphans.length}`
  );
  for (const orphan of report.orphans) {
    console.log(
      `  scorecard ${orphan.scorecardId} (interview_id: ${orphan.interviewId || "(empty)"})`
    );
  }
}
if (report.errors.length > 0) {
  if (apply && report.scanFailed) {
    console.error("A scan failed, so nothing was written.");
  } else if (apply) {
    console.error(
      `${report.errors.length} update(s) failed; all other links were written.`
    );
  }
  console.error(`ERRORS: ${report.errors.length}`);
  for (const entry of report.errors) {
    console.error(
      `  ${entry.tableId ?? ""}${entry.rowId ? ` ${entry.rowId}` : ""}: ${entry.message}`
    );
  }
  process.exit(1);
}
