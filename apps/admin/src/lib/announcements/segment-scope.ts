import { Query } from "@repo/api";
import type { EventSegments, Events } from "@repo/api/types/appwrite";
import type { UserAuthContext } from "@/lib/authorization";
import { getContentOwnership } from "@/lib/content-authorization";
import { withNationalEventScope } from "@/lib/event-scope";
import { hasRowAccess } from "@/lib/utils/authorization";

interface RowLister {
  listRows: <T>(
    databaseId: string,
    tableId: string,
    queries: string[]
  ) => Promise<{ rows: T[] }>;
}

/**
 * Resolve the campus a segment message is scoped to (the segment's own campus,
 * else its event's), or null when the segment or its event is missing or out
 * of the caller's event scope.
 */
export async function resolveSegmentCampus(
  db: unknown,
  ctx: UserAuthContext,
  segmentId: string
): Promise<{ campusId: string | null } | null> {
  const lister = db as RowLister;
  const segments = await lister.listRows<EventSegments>(
    "app",
    "event_segments",
    [Query.equal("$id", segmentId), Query.limit(1)]
  );
  const segment = segments.rows[0];
  if (!segment?.event_id) {
    return null;
  }
  const events = await lister.listRows<Events>("app", "events", [
    Query.equal("$id", segment.event_id),
    Query.limit(1),
  ]);
  const event = events.rows[0];
  if (!event) {
    return null;
  }
  const ownership = getContentOwnership(event, { legacyFallback: true });
  if (
    !hasRowAccess(
      withNationalEventScope(ctx),
      ownership.campus,
      ownership.department
    )
  ) {
    return null;
  }
  return { campusId: segment.campus_id ?? event.campus_id ?? null };
}
