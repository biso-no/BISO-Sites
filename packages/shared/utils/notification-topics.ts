/**
 * The notification topic taxonomy, server side.
 *
 * Mirrors the Flutter client at
 * `BISO-Flutter/lib/core/constants/notification_topics.dart`. The two must
 * agree — a topic id built here that the app never subscribed to reaches
 * nobody, silently. A change in one needs the same change in the other.
 */

/** The topics a student can opt into. `general` is deliberately not one. */
export const NOTIFICATION_TOPICS = ["news", "events", "jobs", "shop"] as const;

export type NotificationTopic = (typeof NOTIFICATION_TOPICS)[number];

/** Whether a string is one of the logical topics a student can opt into. */
export function isNotificationTopic(value: string): value is NotificationTopic {
  return (NOTIFICATION_TOPICS as readonly string[]).includes(value);
}

/**
 * The topic every device is subscribed to, whether or not the student chose
 * anything. Used for broadcasts, so that "everyone" means everyone rather than
 * "everyone who happened to opt into events".
 */
export const GENERAL_TOPIC_ID = "general";

export const NATIONAL_SLUG = "national";

const CAMPUS_SLUGS: Record<string, string> = {
  "1": "oslo",
  "2": "bergen",
  "3": "trondheim",
  "4": "stavanger",
  "5": NATIONAL_SLUG,
};

/**
 * The slug for a campus id, falling back to national for anything unknown.
 *
 * The fallback carries meaning: content with no campus is national content, and
 * every subscriber holds the national scope of the topics they chose.
 */
export function campusSlugFor(campusId?: string | null): string {
  if (!campusId) {
    return NATIONAL_SLUG;
  }
  return CAMPUS_SLUGS[campusId] ?? NATIONAL_SLUG;
}

/** The Appwrite topic id a publisher should push to. */
export function topicIdFor(
  topic: NotificationTopic,
  campusId?: string | null
): string {
  return `${topic}_${campusSlugFor(campusId)}`;
}

/**
 * The inverse of `topicIdFor`: recovers the logical topic from a possibly
 * campus-scoped Appwrite topic id, by stripping a trailing `_<campusSlug>`
 * from a known topic prefix.
 *
 * Used when a `topic` announcement is reopened in an editor: dispatch
 * persists the resolved id onto `audience_value` (see
 * `resolveAnnouncementTopicId` in the admin app), so a previously sent row
 * holds `events_oslo` rather than the logical `events` a topic picker
 * offers. `general` and anything not matching a known topic prefix pass
 * through unchanged.
 */
export function logicalTopicFor(value: string): string {
  for (const topic of NOTIFICATION_TOPICS) {
    if (value === topic || value.startsWith(`${topic}_`)) {
      return topic;
    }
  }
  return value;
}
