"use server";

import { ID, Permission, Query, Role } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
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
 * Upserts the current user's progress for a single tour. The (user_id, tour_id)
 * pair is unique, so we look up an existing row and update it, otherwise create
 * a new row with owner-scoped document permissions (rowSecurity is on).
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

  const existing = await db.listRows<TourProgress>(DB_ID, TABLE_ID, [
    Query.equal("user_id", user.$id),
    Query.equal("tour_id", record.tourId),
    Query.limit(1),
  ]);

  const current = existing.rows[0];
  if (current) {
    await db.updateRow(DB_ID, TABLE_ID, current.$id, data);
    return;
  }

  await db.createRow(DB_ID, TABLE_ID, ID.unique(), data, [
    Permission.read(Role.user(user.$id)),
    Permission.update(Role.user(user.$id)),
    Permission.delete(Role.user(user.$id)),
  ]);
}
