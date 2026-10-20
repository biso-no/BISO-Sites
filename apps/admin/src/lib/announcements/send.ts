import "server-only";

import { Query } from "@repo/api";
import {
  type Announcements,
  AnnouncementsAudienceType,
  AnnouncementsStatus,
} from "@repo/api/types/appwrite";
import {
  buildDeepLink,
  buildPushData,
  type DispatchClients,
  dispatchAnnouncement,
} from "@repo/shared/utils/push-dispatch";

// The push dispatch itself lives in `@repo/shared/utils/push-dispatch` so admin
// and the content-notifier Appwrite Function share one implementation.
// Re-exported here so admin callers keep importing from
// `@/lib/announcements/send`.
export {
  buildDeepLink,
  buildPushData,
  type DispatchAnnouncementResult,
  type DispatchClients,
  dispatchAnnouncement,
  htmlToPlainText,
} from "@repo/shared/utils/push-dispatch";

/** Max scheduled announcements processed in a single dispatch run. */
const DUE_ANNOUNCEMENTS_PAGE_SIZE = 50;

export interface DispatchDueResult {
  failed: number;
  processed: number;
  sent: number;
}

/**
 * Find every announcement whose scheduled send time has passed and dispatch it,
 * flipping each to `sent` (or `failed`). Intended to be driven by a scheduled
 * Appwrite Function via the secret-gated dispatch route.
 */
export async function dispatchDueAnnouncements(
  clients: DispatchClients,
  now: Date = new Date()
): Promise<DispatchDueResult> {
  const { db } = clients;
  const due = await db.listRows<Announcements>("app", "announcements", [
    Query.equal("status", AnnouncementsStatus.SCHEDULED),
    Query.lessThanEqual("scheduled_at", now.toISOString()),
    Query.isNull("data"),
    Query.limit(DUE_ANNOUNCEMENTS_PAGE_SIZE),
  ]);

  const result: DispatchDueResult = {
    processed: due.rows.length,
    sent: 0,
    failed: 0,
  };

  for (const announcement of due.rows) {
    const enriched: Announcements = {
      ...announcement,
      data: JSON.stringify(buildPushData(announcement)),
      deep_link: announcement.deep_link ?? buildDeepLink(announcement),
    };
    try {
      const dispatchResult = await dispatchAnnouncement(enriched, clients);
      await db.updateRow("app", "announcements", announcement.$id, {
        status: AnnouncementsStatus.SENT,
        sent_at: now.toISOString(),
        data: enriched.data,
        deep_link: enriched.deep_link,
        // Persist the resolved channel onto a TOPIC or BROADCAST row so it
        // records what it was actually pushed to (see
        // `DispatchAnnouncementResult`). Idempotent: an already-resolved
        // `audience_value` resolves to itself, so re-dispatching a row doesn't
        // change it further.
        ...((announcement.audience_type === AnnouncementsAudienceType.TOPIC ||
          announcement.audience_type === AnnouncementsAudienceType.BROADCAST) &&
        dispatchResult.topic
          ? { audience_value: dispatchResult.topic }
          : {}),
      });
      result.sent += 1;
    } catch (error) {
      console.error(
        `Failed to dispatch scheduled announcement ${announcement.$id}:`,
        error
      );
      await db
        .updateRow("app", "announcements", announcement.$id, {
          status: AnnouncementsStatus.FAILED,
        })
        .catch(() => {
          // Best-effort; leave it scheduled to retry on the next run.
        });
      result.failed += 1;
    }
  }

  return result;
}
