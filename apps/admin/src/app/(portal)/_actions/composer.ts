"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  EventSegments,
  Events,
  Jobs,
  News,
  SegmentMembers,
  Users,
} from "@repo/api/types/appwrite";
import { resolvePushChannel } from "@repo/shared/utils/notification-topics";
import {
  canSendNotifications,
  isAudienceAllowed,
} from "@/lib/announcements/audience-policy";
import {
  type ComposerContentType,
  campusNameFor,
  dateLabelFor,
  type LinkableItem,
  type PersonResult,
  pickEnglishFirstTitle,
  reachSentence,
  toLinkableItem,
  toPersonResult,
  toPrefill,
} from "@/lib/announcements/composer-lookups";
import { resolveSegmentCampus } from "@/lib/announcements/segment-scope";
import { requireAuth, type UserAuthContext } from "@/lib/authorization";
import { applyContentRelationshipScopeQueries } from "@/lib/content-authorization";
import { withNationalEventScope } from "@/lib/event-scope";
import { getChannelSubscriberCount } from "@/lib/notifications/topic-subscribers";
import { listSegments } from "./event-segments";

const MIN_QUERY_LENGTH = 2;
const SEARCH_LIMIT = 10;
const NEWEST_LIMIT = 8;
const PEOPLE_LIMIT = 10;
const SEGMENT_SCAN_LIMIT = 500;
const EVENT_LOAD_LIMIT = 100;
const USER_ID_LIMIT = 100;
const LISTED_STATUSES = ["published", "draft"];

const TABLES: Record<ComposerContentType, string> = {
  event: "events",
  news: "news",
  job: "jobs",
};

function translationsKey(type: ComposerContentType): string {
  return type === "job" ? "translations" : "translation_refs";
}

/** Campus scope for the "newest" list: all for global admins, else managed. */
function ownCampusQueries(ctx: UserAuthContext): string[] {
  if (ctx.roles.includes("globaladmin")) {
    return [];
  }
  return [
    Query.equal(
      "campus.$id",
      ctx.managedCampusIds.length > 0
        ? ctx.managedCampusIds
        : ["__no_scope_resolved__"]
    ),
  ];
}

export async function searchLinkableContent(
  type: ComposerContentType,
  query: string
): Promise<LinkableItem[]> {
  const ctx = await requireAuth();
  if (!canSendNotifications(ctx.roles)) {
    return [];
  }
  const q = query.trim();
  const key = translationsKey(type);
  const searching = q.length >= MIN_QUERY_LENGTH;
  const { db } = await createAdminClient();
  const response = await db.listRows<Events | Jobs | News>(
    "app",
    TABLES[type],
    [
      Query.select(["*", `${key}.*`]),
      Query.equal("status", LISTED_STATUSES),
      ...(searching
        ? [Query.search(`${key}.title`, q), Query.limit(SEARCH_LIMIT)]
        : [
            Query.orderDesc("$createdAt"),
            Query.limit(NEWEST_LIMIT),
            ...ownCampusQueries(
              type === "event" ? withNationalEventScope(ctx) : ctx
            ),
          ]),
    ]
  );
  return response.rows.map((row) => toLinkableItem(type, row));
}

export async function getLinkedContentPrefill(
  type: ComposerContentType,
  id: string
) {
  const ctx = await requireAuth();
  if (!canSendNotifications(ctx.roles)) {
    return null;
  }
  const { db } = await createAdminClient();
  const response = await db.listRows<Events | Jobs | News>(
    "app",
    TABLES[type],
    [
      Query.select(["*", `${translationsKey(type)}.*`]),
      Query.equal("$id", id),
      Query.limit(1),
    ]
  );
  const row = response.rows[0];
  return row ? toPrefill(type, row) : null;
}

export async function searchPeople(query: string): Promise<PersonResult[]> {
  const ctx = await requireAuth();
  const q = query.trim();
  if (!canSendNotifications(ctx.roles) || q.length < MIN_QUERY_LENGTH) {
    return [];
  }
  // The user table is readable only with the service key.
  const { db } = await createAdminClient();
  const response = await db.listRows<Users>("app", "user", [
    Query.or([Query.contains("name", q), Query.contains("email", q)]),
    Query.limit(PEOPLE_LIMIT),
  ]);
  return response.rows.map((row) => toPersonResult(row));
}

export async function getPeopleByIds(ids: string[]): Promise<PersonResult[]> {
  const ctx = await requireAuth();
  const wanted = ids.slice(0, USER_ID_LIMIT);
  if (!canSendNotifications(ctx.roles) || wanted.length === 0) {
    return [];
  }
  const { db } = await createAdminClient();
  const response = await db.listRows<Users>("app", "user", [
    Query.equal("$id", wanted),
    Query.limit(USER_ID_LIMIT),
  ]);
  return response.rows.map((row) => toPersonResult(row));
}

export async function listEventsWithGroups(
  query: string
): Promise<
  Array<{ id: string; title: string; dateLabel: string; campusName: string }>
> {
  const ctx = await requireAuth();
  if (!canSendNotifications(ctx.roles)) {
    return [];
  }
  const scoped = withNationalEventScope(ctx);
  const { db } = await createAdminClient();
  const segments = await db.listRows<EventSegments>("app", "event_segments", [
    Query.orderDesc("$createdAt"),
    Query.limit(SEGMENT_SCAN_LIMIT),
  ]);
  const eventIds = [
    ...new Set(
      segments.rows.flatMap((row) => (row.event_id ? [row.event_id] : []))
    ),
  ].slice(0, EVENT_LOAD_LIMIT);
  if (eventIds.length === 0) {
    return [];
  }
  const events = await db.listRows<Events>("app", "events", [
    Query.select(["*", "translation_refs.*"]),
    Query.equal("$id", eventIds),
    Query.limit(EVENT_LOAD_LIMIT),
    ...applyContentRelationshipScopeQueries(scoped),
  ]);
  const needle = query.trim().toLowerCase();
  return events.rows
    .map((row) => ({
      id: row.$id,
      title: pickEnglishFirstTitle(row.translation_refs, row.$id),
      dateLabel: dateLabelFor("event", row.start_date),
      campusName: campusNameFor(row.campus_id),
    }))
    .filter((event) => event.title.toLowerCase().includes(needle))
    .slice(0, SEARCH_LIMIT);
}

export async function listGroupsForEvent(eventId: string): Promise<
  Array<{
    id: string;
    name: string;
    memberCount: number;
    campusId: string | null;
  }>
> {
  const ctx = await requireAuth();
  if (!canSendNotifications(ctx.roles)) {
    return [];
  }
  const segments = await listSegments(eventId);
  return segments.map((segment) => ({
    id: segment.$id,
    name: segment.name,
    memberCount: segment.member_count,
    campusId: segment.campus_id,
  }));
}

export interface AudienceReachRequest {
  audienceType: "broadcast" | "topic" | "users" | "segment";
  audienceValue: string | null;
  campusId: string | null;
  /** Recipients picked for a `users` audience. */
  userIds?: string[];
}

export async function getAudienceReach(
  req: AudienceReachRequest
): Promise<{ count: number | null; sentence: string }> {
  const ctx = await requireAuth();
  const empty = {
    count: null,
    sentence: reachSentence({ ...req, count: null }),
  };
  if (!canSendNotifications(ctx.roles)) {
    return empty;
  }

  if (req.audienceType === "users") {
    const count = req.userIds?.length ?? 0;
    return { count, sentence: reachSentence({ ...req, count }) };
  }

  if (req.audienceType === "segment") {
    if (!req.audienceValue) {
      return empty;
    }
    try {
      const { db } = await createAdminClient();
      const resolved = await resolveSegmentCampus(db, ctx, req.audienceValue);
      if (
        !(
          resolved &&
          isAudienceAllowed(
            { roles: ctx.roles, managedCampusIds: ctx.managedCampusIds },
            { ...req, segmentCampusId: resolved.campusId }
          )
        )
      ) {
        return empty;
      }
      const segment = await db.getRow<EventSegments>(
        "app",
        "event_segments",
        req.audienceValue
      );
      const members = await db.listRows<SegmentMembers>(
        "app",
        "segment_members",
        [Query.equal("segment_id", segment.$id), Query.limit(1)]
      );
      return {
        count: members.total,
        sentence: reachSentence({
          ...req,
          count: members.total,
          groupName: segment.name,
        }),
      };
    } catch (error) {
      console.error("[composer] segment reach failed:", error);
      return empty;
    }
  }

  if (
    !isAudienceAllowed(
      { roles: ctx.roles, managedCampusIds: ctx.managedCampusIds },
      req
    )
  ) {
    return empty;
  }

  const channel = resolvePushChannel(
    req.audienceType,
    req.audienceValue,
    req.campusId
  );
  const count = channel ? await getChannelSubscriberCount(channel) : null;
  return { count, sentence: reachSentence({ ...req, count }) };
}
