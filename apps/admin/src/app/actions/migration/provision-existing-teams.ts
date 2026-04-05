"use server";

/**
 * Migration: grant create/update/delete table-level permissions on all content
 * tables (events, jobs, news, webshop_products, pages, content_translations,
 * page_translations) to all existing SG-App-* Appwrite teams.
 *
 * Re-run whenever CONTENT_TABLES is extended (e.g. adding translation tables)
 * to bring existing teams up to date. Idempotent — skips perms already present.
 */

import { createAdminClient } from "@repo/api/server";
import { isGlobalAdmin } from "@/lib/authorization";
import { grantTeamContentAccess } from "@/lib/team-provisioning";

export async function runProvisionExistingTeams(): Promise<{
  success: boolean;
  provisioned: number;
  errors: number;
  error?: string;
}> {
  if (!(await isGlobalAdmin())) {
    return { success: false, provisioned: 0, errors: 0, error: "Unauthorized" };
  }

  const { teams } = await createAdminClient();
  let provisioned = 0;
  let errors = 0;

  // Fetch all teams (paginate if needed)
  let _offset = 0;
  const BATCH = 100;

  while (true) {
    const page = await teams.list();
    const sgAppTeams = page.teams.filter(
      (t) =>
        t.name.startsWith("SG-App-Campus-") || t.name.startsWith("SG-App-Dept-")
    );

    for (const team of sgAppTeams) {
      try {
        await grantTeamContentAccess(team.$id);
        provisioned++;
        console.log(`Provisioned content access for team: ${team.name}`);
      } catch (err) {
        console.error(`Failed to provision team ${team.name}:`, err);
        errors++;
      }
    }

    _offset += BATCH;
    if (page.teams.length < BATCH) {
      break;
    }
  }

  return { success: true, provisioned, errors };
}
