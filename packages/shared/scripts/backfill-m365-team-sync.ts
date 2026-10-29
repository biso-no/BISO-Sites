/**
 * Write each Microsoft user's m365_team_sync record from their current
 * Microsoft groups: the team ids the admin's sign-in sync records. Dry-run by
 * default; pass --apply to write. Safe to re-run.
 *
 * Order: push the m365_team_sync table, run this (dry run, then --apply), then
 * deploy the admin and API builds that read the record. Deploying first leaves
 * every admin without access until they sign in with Microsoft again.
 *
 * Usage (from packages/shared):
 *   bun run backfill:m365-team-sync            # dry run
 *   bun run backfill:m365-team-sync -- --apply
 */
import { GraphUserService } from "@repo/connectors/azure/users";
import { Client, TablesDB, Users } from "node-appwrite";
import {
  backfillM365TeamSync,
  type M365TeamSyncReport,
  microsoftIdentities,
  teamSyncRecordStore,
} from "../utils/m365-team-sync-backfill";

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

// The same names and fallbacks the API's Graph routes read.
const tenantId =
  process.env.AZURE_GRAPH_TENANT_ID || process.env.AZURE_TENANT_ID || "";
const clientId =
  process.env.AZURE_GRAPH_CLIENT_ID || process.env.AZURE_APP_ID || "";
const clientSecret =
  process.env.AZURE_GRAPH_CLIENT_SECRET ||
  process.env.SHAREPOINT_CLIENT_SECRET ||
  "";

if (!(tenantId && clientId && clientSecret)) {
  console.error(
    "Missing Microsoft Graph configuration: need AZURE_GRAPH_TENANT_ID, AZURE_GRAPH_CLIENT_ID, and AZURE_GRAPH_CLIENT_SECRET (or AZURE_TENANT_ID, AZURE_APP_ID, and SHAREPOINT_CLIENT_SECRET)."
  );
  process.exit(2);
}

const apply = process.argv.includes("--apply");
console.log(`Mode: ${apply ? "APPLY" : "dry-run"}`);
console.log(`Endpoint: ${endpoint}`);
console.log(`Project: ${project}`);
console.log(`Graph tenant: ${tenantId}`);

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(project)
  .setKey(apiKey);
const users = new Users(client);
const graph = new GraphUserService(tenantId, clientId, clientSecret);

let report: M365TeamSyncReport;
try {
  report = await backfillM365TeamSync(
    {
      listMicrosoftIdentities: () => microsoftIdentities(users),
      groupNamesFor: (providerUid) =>
        graph.listTransitiveGroupNames(providerUid),
      ...teamSyncRecordStore(new TablesDB(client)),
    },
    { apply }
  );
} catch (error) {
  // Only the identity listing gets here; per-user failures are in the report.
  console.error(
    `Listing Microsoft identities failed: ${error instanceof Error ? error.message : String(error)}`
  );
  if (apply) {
    console.error(
      "Records written before the failure stay. Run it again to finish."
    );
  }
  process.exit(1);
}

const showIds = (ids: string[] | null) =>
  ids === null ? "(no record)" : `[${ids.join(", ")}]`;

console.log(`Microsoft users scanned: ${report.scanned}`);
console.log(`${apply ? "Written" : "Would write"}: ${report.changes.length}`);
for (const change of report.changes) {
  console.log(
    `  ${change.userId}: ${showIds(change.before)} → ${showIds(change.after)}`
  );
}
if (report.errors.length > 0) {
  console.error(`ERRORS (users skipped): ${report.errors.length}`);
  for (const entry of report.errors) {
    console.error(`  ${entry.userId}: ${entry.message}`);
  }
  process.exit(1);
}
