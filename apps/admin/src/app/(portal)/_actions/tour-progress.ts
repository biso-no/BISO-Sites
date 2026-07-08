"use server";

import { ID, Permission, Query, Role } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { TourProgress } from "@repo/api/types/appwrite";
import type { TourProgressRecord, TourStatus } from "@repo/tours/types";

const DB_ID = "app";
const TABLE_ID = "tour_progress";
const MAX_TOURS = 100;

function toRecord(row: TourProgress): TourProgressRecord {
  return {
    tourId: row.tour_id,
    // DB enum values are identical to the package's TourStatus literals.
    status: row.status as unknown as TourStatus,
    stepIndex: row.step_index,
    version: row.version,
  };
}

/**
 * Returns every tour-progress record owned by the current user. Resolves to an
 * empty list when there is no authenticated session (e.g. anonymous visitor),
 * so the tour engine simply treats every tour as "not started".
 */
export async function loadTourProgress(): Promise<TourProgressRecord[]> {
  try {
    const { account, db } = await createSessionClient();
    const user = await account.get();
    const result = await db.listRows<TourProgress>(DB_ID, TABLE_ID, [
      Query.equal("user_id", user.$id),
      Query.limit(MAX_TOURS),
    ]);
    return result.rows.map(toRecord);
  } catch {
    return [];
  }
}

/**
 * Upserts the current user's progress for a single tour. (user_id, tour_id) is
 * unique: we update an existing row, otherwise create one with owner-scoped
 * permissions (rowSecurity is on). If two first-time saves race — e.g. the
 * auto-start save and the first step-change save firing back to back — both can
 * see no existing row, but only one create wins the unique index. We catch the
 * loser's duplicate-create error, re-read the winning row, and update it, so the
 * latest progress is never silently dropped.
 */
export async function saveTourProgress(
  record: TourProgressRecord
): Promise<void> {
  const { account, db } = await createSessionClient();
  const user = await account.get();

  const data = {
    user_id: user.$id,
    tour_id: record.tourId,
    status: record.status,
    step_index: record.stepIndex,
    version: record.version,
    completed_at:
      record.status === "completed" ? new Date().toISOString() : null,
  };

  const lookup = [
    Query.equal("user_id", user.$id),
    Query.equal("tour_id", record.tourId),
    Query.limit(1),
  ];

  const existing = await db.listRows<TourProgress>(DB_ID, TABLE_ID, lookup);
  const current = existing.rows[0];
  if (current) {
    await db.updateRow(DB_ID, TABLE_ID, current.$id, data);
    return;
  }

  // tour_progress carries no collection-level create grant (rows are
  // owner-scoped with rowSecurity on), so the session client cannot insert the
  // first row. Create it with the admin client and stamp owner row permissions
  // so read/update/delete stay scoped to this user; the session client handles
  // every subsequent read/update.
  const { db: adminDb } = await createAdminClient();
  try {
    await adminDb.createRow(DB_ID, TABLE_ID, ID.unique(), data, [
      Permission.read(Role.user(user.$id)),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ]);
  } catch (error) {
    const retry = await db.listRows<TourProgress>(DB_ID, TABLE_ID, lookup);
    const winner = retry.rows[0];
    if (!winner) {
      throw error;
    }
    await db.updateRow(DB_ID, TABLE_ID, winner.$id, data);
  }
}
