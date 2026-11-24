"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Departments } from "@repo/api/types/appwrite";
import { BIG_EVENT_TABLES } from "@repo/shared/big-events/tables";
import type { BigEventRow } from "@repo/shared/big-events/types";
import { revalidatePath } from "next/cache";
import { cache } from "react";
import { requireAuth, type UserAuthContext } from "@/lib/authorization";
import {
  type BigEventAccess,
  bigEventAccess,
  canCreateBigEvent,
  canEditBigEventSettings,
  participantCampusFilter,
  visibleBigEventFilters,
} from "@/lib/big-events/access";
import {
  type BigEventFormValues,
  type BigEventUpdateValues,
  bigEventColumns,
  bigEventFormSchema,
  bigEventUpdateSchema,
} from "@/lib/big-events/form-schema";
import {
  bigEventSlugCandidates,
  slugifyBigEventName,
} from "@/lib/big-events/slug";
import { ROLES } from "@/lib/roles";
import { logAuditEvent } from "./audit-log";

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];
type GrantedAccess = Exclude<BigEventAccess, null>;

export type BigEventListItem = BigEventRow & {
  access: GrantedAccess["level"];
  linkedCount: number;
  participantCount: number;
};

const DATABASE_ID = "app";
const LIST_LIMIT = 100;
const SLUG_CANDIDATES = 50;
const DATE_COLUMNS = new Set(["ends_at", "starts_at"]);

/** Loads a big event and the caller's access; null when missing or not allowed. */
async function loadBigEvent(
  db: AdminDb,
  ctx: UserAuthContext,
  id: string
): Promise<{ event: BigEventRow; access: GrantedAccess } | null> {
  const response = await db.listRows<BigEventRow>(
    DATABASE_ID,
    BIG_EVENT_TABLES.events,
    [Query.equal("$id", [id]), Query.limit(1)]
  );
  const event = response.rows[0];
  if (!event) {
    return null;
  }
  const access = bigEventAccess(ctx, event);
  return access ? { access, event } : null;
}

async function countParticipants(
  db: AdminDb,
  eventId: string,
  access: GrantedAccess
): Promise<{ linkedCount: number; participantCount: number }> {
  const scope = [
    Query.equal("big_event_id", [eventId]),
    ...participantCampusFilter(access),
  ];
  const [all, linked] = await Promise.all([
    db.listRows(DATABASE_ID, BIG_EVENT_TABLES.participants, [
      ...scope,
      Query.limit(1),
    ]),
    db.listRows(DATABASE_ID, BIG_EVENT_TABLES.participants, [
      ...scope,
      Query.isNotNull("user_id"),
      Query.limit(1),
    ]),
  ]);
  return { linkedCount: linked.total, participantCount: all.total };
}

/** The owning board must be a department on the big event's campus. */
async function assertBoardOnCampus(
  db: AdminDb,
  departmentId: string | null,
  campusId: string
): Promise<void> {
  if (departmentId === null) {
    return;
  }
  const response = await db.listRows<Departments>(DATABASE_ID, "departments", [
    Query.equal("$id", [departmentId]),
    Query.equal("campus_id", [campusId]),
    Query.limit(1),
  ]);
  if (response.rows.length === 0) {
    throw new Error("The chosen board does not belong to this campus");
  }
}

/** Column names whose value differs; dates compare as instants (Appwrite returns `+00:00`). */
function changedColumns(
  before: BigEventRow,
  after: Record<string, unknown>
): string[] {
  return Object.entries(after)
    .filter(([key, value]) => {
      const old = before[key as keyof BigEventRow];
      if (DATE_COLUMNS.has(key)) {
        return Date.parse(String(old)) !== Date.parse(String(value));
      }
      return old !== value;
    })
    .map(([key]) => key);
}

async function pickFreeSlug(db: AdminDb, name: string): Promise<string> {
  const candidates = bigEventSlugCandidates(
    slugifyBigEventName(name),
    SLUG_CANDIDATES
  );
  const response = await db.listRows<BigEventRow>(
    DATABASE_ID,
    BIG_EVENT_TABLES.events,
    [
      Query.equal("slug", candidates),
      Query.select(["$id", "slug"]),
      Query.limit(candidates.length),
    ]
  );
  const taken = new Set(response.rows.map((row) => row.slug));
  const free = candidates.find((candidate) => !taken.has(candidate));
  if (!free) {
    throw new Error("Could not find a free web address for this big event");
  }
  return free;
}

export async function listBigEvents(): Promise<BigEventListItem[]> {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();
  const response = await db.listRows<BigEventRow>(
    DATABASE_ID,
    BIG_EVENT_TABLES.events,
    [
      ...visibleBigEventFilters(ctx),
      Query.orderDesc("starts_at"),
      Query.limit(LIST_LIMIT),
    ]
  );
  const visible = response.rows.flatMap((event) => {
    const access = bigEventAccess(ctx, event);
    return access ? [{ access, event }] : [];
  });
  return await Promise.all(
    visible.map(async ({ access, event }) => ({
      ...event,
      ...(await countParticipants(db, event.$id, access)),
      access: access.level,
    }))
  );
}

/** One read per request: the `[id]` layout and its tab page both ask. */
const loadBigEventOncePerRequest = cache(async (id: string) => {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();
  return await loadBigEvent(db, ctx, id);
});

/** The big event and the caller's access, or null. Call first in every big event action. */
export async function getBigEvent(
  id: string
): Promise<{ event: BigEventRow; access: GrantedAccess } | null> {
  return await loadBigEventOncePerRequest(id);
}

export async function createBigEvent(
  values: BigEventFormValues
): Promise<{ id: string }> {
  const ctx = await requireAuth();
  const data = bigEventFormSchema.parse(values);
  if (!canCreateBigEvent(ctx, data.campus_id)) {
    throw new Error("You can't create a big event on this campus");
  }
  const { db } = await createAdminClient();
  await assertBoardOnCampus(db, data.department_id, data.campus_id);
  const slug = await pickFreeSlug(db, data.name_no);
  const row = await db.createRow(
    DATABASE_ID,
    BIG_EVENT_TABLES.events,
    ID.unique(),
    {
      ...bigEventColumns(data),
      created_by: ctx.userId,
      slug,
      status: "draft",
    }
  );
  await logAuditEvent(ctx, "big_event.create", {
    payload: { campus_id: data.campus_id, slug },
    resourceId: row.$id,
    resourceType: "big_event",
  });
  revalidatePath("/big-events");
  return { id: row.$id };
}

export async function updateBigEvent(
  id: string,
  values: BigEventUpdateValues
): Promise<void> {
  const ctx = await requireAuth();
  const data = bigEventUpdateSchema.parse(values);
  const { db } = await createAdminClient();
  const found = await loadBigEvent(db, ctx, id);
  if (!(found && canEditBigEventSettings(found.access))) {
    throw new Error("You can't change the settings of this big event");
  }
  const campusChanged = data.campus_id !== found.event.campus_id;
  if (campusChanged && !ctx.roles.includes(ROLES.GLOBAL_ADMIN)) {
    throw new Error(
      "Only global admins can move a big event to another campus"
    );
  }
  await assertBoardOnCampus(db, data.department_id, data.campus_id);
  const columns = { ...bigEventColumns(data), status: data.status };
  await db.updateRow(DATABASE_ID, BIG_EVENT_TABLES.events, id, columns);
  await logAuditEvent(ctx, "big_event.update", {
    payload: { changed: changedColumns(found.event, columns) },
    resourceId: id,
    resourceType: "big_event",
  });
  revalidatePath("/big-events");
  revalidatePath(`/big-events/${id}`, "layout");
}
