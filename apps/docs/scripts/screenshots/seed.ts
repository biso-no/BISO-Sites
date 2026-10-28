/**
 * Seeds the docs-only Appwrite project with the made-up data in
 * `seed-data.ts`: users, the teams the admin's role logic reads, and the
 * recruitment rows. Safe to run again: everything is upserted by fixed id.
 *
 * Usage (from apps/docs): bun run screenshots:seed
 * See README.md in this folder. Never point it at production; the config
 * guard refuses to.
 */
import { isNotFound } from "@repo/api/errors";
import { readScreenshotConfig } from "./config";
import { connectToDocsProject, type DocsAdminClient } from "./docs-project";
import {
  buildSeedData,
  type SeedData,
  type SeedTeam,
  type SeedUser,
} from "./seed-data";

/** Memberships in these teams decide admin roles; the seed owns them. */
const ROLE_TEAM_PREFIXES = ["sg-app-campus-", "sg-app-dept-"] as const;
const MEMBER_ROLE = "member";

function write(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function orNullIfMissing<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

async function ensureUser(
  users: DocsAdminClient["users"],
  user: SeedUser
): Promise<void> {
  const existing = await orNullIfMissing(users.get({ userId: user.id }));
  if (existing) {
    if (existing.name !== user.name) {
      await users.updateName({ name: user.name, userId: user.id });
    }
    if (existing.email !== user.email) {
      await users.updateEmail({ email: user.email, userId: user.id });
    }
  } else {
    await users.create({ email: user.email, name: user.name, userId: user.id });
  }
  await users.updateEmailVerification({
    emailVerification: true,
    userId: user.id,
  });
}

async function ensureTeam(
  teams: DocsAdminClient["teams"],
  team: SeedTeam
): Promise<void> {
  const existing = await orNullIfMissing(teams.get({ teamId: team.id }));
  if (!existing) {
    await teams.create({ name: team.name, teamId: team.id });
  } else if (existing.name !== team.name) {
    await teams.updateName({ name: team.name, teamId: team.id });
  }
}

/**
 * Leaves each user in exactly their seeded role teams: adds the missing
 * memberships and removes any other role-team membership, so a user can
 * never end up with a role the seed didn't give them.
 */
async function ensureMemberships(
  client: DocsAdminClient,
  user: SeedUser
): Promise<void> {
  const { memberships } = await client.users.listMemberships({
    userId: user.id,
  });
  const expected = new Set(user.teamIds);

  for (const membership of memberships) {
    const isRoleTeam = ROLE_TEAM_PREFIXES.some((prefix) =>
      membership.teamId.startsWith(prefix)
    );
    if (isRoleTeam && !expected.has(membership.teamId)) {
      await client.teams.deleteMembership({
        membershipId: membership.$id,
        teamId: membership.teamId,
      });
    }
  }

  const current = new Set(memberships.map((membership) => membership.teamId));
  for (const teamId of user.teamIds) {
    if (!current.has(teamId)) {
      await client.teams.createMembership({
        roles: [MEMBER_ROLE],
        teamId,
        userId: user.id,
      });
    }
  }
}

async function writeRows(
  db: DocsAdminClient["db"],
  seed: SeedData
): Promise<void> {
  for (const row of seed.rows) {
    await db.upsertRow({
      data: row.data,
      databaseId: seed.databaseId,
      permissions: row.permissions,
      rowId: row.rowId,
      tableId: row.tableId,
    });
  }
}

async function main(): Promise<void> {
  // The guard reads the shell's env before anything changes it.
  const config = readScreenshotConfig({ ...process.env });
  const client = await connectToDocsProject(config);
  const seed = buildSeedData();

  write(`Seeding the docs project "${config.projectId}".`);
  for (const user of seed.users) {
    await ensureUser(client.users, user);
  }
  for (const team of seed.teams) {
    await ensureTeam(client.teams, team);
  }
  for (const user of seed.users) {
    await ensureMemberships(client, user);
  }
  await writeRows(client.db, seed);

  write(`Wrote ${seed.rows.length} rows and ${seed.teams.length} teams.`);
  write("Staff users:");
  for (const user of seed.users) {
    write(`  ${user.id}  ${user.role.padEnd(11)}  ${user.name}`);
  }
}

// Only when run as a script: importing this file never starts a seed run.
if (import.meta.main) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Seeding failed: ${message}\n`);
    process.exitCode = 1;
  });
}
