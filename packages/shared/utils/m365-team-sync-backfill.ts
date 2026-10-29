import { Query } from "@repo/api";
import { orNullIfNotFound } from "@repo/api/errors";
import { M365_TEAM_SYNC_TABLE_ID, syncedTeamIdForGroup } from "./team-roles";

/**
 * Write each Microsoft user's `m365_team_sync` record from their current
 * Microsoft groups, the same ids `syncM365Permissions` records at sign-in.
 * Admin and the API keep an `sg-app-*` team only when its id is in the
 * caller's record, so this runs before the code that reads the record is
 * deployed; otherwise every admin loses access until their next Microsoft
 * sign-in.
 *
 * Each record describes only its own user's groups, so a failure for one user
 * is reported and that user is skipped; the rest still run. Safe to re-run.
 */

const DATABASE_ID = "app";
const IDENTITY_PAGE_SIZE = 100;
const MICROSOFT_PROVIDER = "microsoft";

export interface MicrosoftIdentityRef {
  providerUid: string;
  userId: string;
}

export interface M365TeamSyncDeps {
  /** The user's Microsoft group display names, transitive, every page. */
  groupNamesFor(providerUid: string): Promise<string[]>;
  listMicrosoftIdentities(): AsyncIterable<MicrosoftIdentityRef>;
  /** The record's team ids, or null when the user has no record. */
  readRecord(userId: string): Promise<string[] | null>;
  writeRecord(userId: string, teamIds: string[]): Promise<void>;
}

export interface M365TeamSyncChange {
  after: string[];
  before: string[] | null;
  userId: string;
}

export interface M365TeamSyncReport {
  changes: M365TeamSyncChange[];
  errors: { message: string; userId: string }[];
  scanned: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The team ids the sync gives these groups: sorted, unique. */
export function syncedTeamIdsForGroups(
  groupNames: readonly string[]
): string[] {
  const ids = new Set<string>();
  for (const name of groupNames) {
    const id = syncedTeamIdForGroup(name);
    if (id !== null) {
      ids.add(id);
    }
  }
  return [...ids].sort();
}

/** A missing record counts as an empty one. */
function sameTeamIds(
  before: readonly string[] | null,
  after: readonly string[]
): boolean {
  const current = new Set(before ?? []);
  return current.size === after.length && after.every((id) => current.has(id));
}

export async function backfillM365TeamSync(
  deps: M365TeamSyncDeps,
  options: { apply: boolean }
): Promise<M365TeamSyncReport> {
  const report: M365TeamSyncReport = { changes: [], errors: [], scanned: 0 };
  const seen = new Set<string>();

  for await (const { userId, providerUid } of deps.listMicrosoftIdentities()) {
    // The sign-in sync reads a user's first Microsoft identity; do the same.
    if (seen.has(userId)) {
      continue;
    }
    seen.add(userId);
    report.scanned += 1;

    let before: string[] | null;
    let after: string[];
    try {
      after = syncedTeamIdsForGroups(await deps.groupNamesFor(providerUid));
      before = await deps.readRecord(userId);
    } catch (error) {
      report.errors.push({ userId, message: errorMessage(error) });
      continue;
    }

    if (sameTeamIds(before, after)) {
      continue;
    }

    if (options.apply) {
      try {
        await deps.writeRecord(userId, after);
      } catch (error) {
        report.errors.push({ userId, message: errorMessage(error) });
        continue;
      }
    }
    report.changes.push({ userId, before, after });
  }

  return report;
}

/** Minimal slice of node-appwrite's `Users`. */
export interface IdentityLister {
  listIdentities(params: { queries: string[] }): Promise<{
    identities: {
      $id: string;
      provider: string;
      providerUid: string;
      userId: string;
    }[];
  }>;
}

/** Every Microsoft identity in the project, cursor-paginated. */
export async function* microsoftIdentities(
  users: IdentityLister
): AsyncIterable<MicrosoftIdentityRef> {
  let cursor: string | null = null;
  for (;;) {
    const queries = [
      Query.equal("provider", MICROSOFT_PROVIDER),
      Query.limit(IDENTITY_PAGE_SIZE),
    ];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    const { identities } = await users.listIdentities({ queries });
    for (const identity of identities) {
      if (identity.provider === MICROSOFT_PROVIDER && identity.providerUid) {
        yield { userId: identity.userId, providerUid: identity.providerUid };
      }
    }
    const last = identities.at(-1);
    if (identities.length < IDENTITY_PAGE_SIZE || !last) {
      return;
    }
    cursor = last.$id;
  }
}

/** Minimal slice of node-appwrite's `TablesDB`. */
export interface TeamSyncDb {
  getRow(params: {
    databaseId: string;
    rowId: string;
    tableId: string;
  }): Promise<{ team_ids?: unknown }>;
  upsertRow(params: {
    data: Record<string, unknown>;
    databaseId: string;
    permissions: string[];
    rowId: string;
    tableId: string;
  }): Promise<unknown>;
}

/** Reads and writes `m365_team_sync` rows, the way the sign-in sync does. */
export function teamSyncRecordStore(
  db: TeamSyncDb
): Pick<M365TeamSyncDeps, "readRecord" | "writeRecord"> {
  return {
    readRecord: async (userId) => {
      const row = await orNullIfNotFound(
        db.getRow({
          databaseId: DATABASE_ID,
          tableId: M365_TEAM_SYNC_TABLE_ID,
          rowId: userId,
        })
      );
      if (row === null) {
        return null;
      }
      return Array.isArray(row.team_ids)
        ? row.team_ids.filter((id): id is string => typeof id === "string")
        : [];
    },
    writeRecord: async (userId, teamIds) => {
      await db.upsertRow({
        databaseId: DATABASE_ID,
        tableId: M365_TEAM_SYNC_TABLE_ID,
        rowId: userId,
        data: { team_ids: teamIds, synced_at: new Date().toISOString() },
        // Service-only: nobody reads or writes it through a session.
        permissions: [],
      });
    },
  };
}
