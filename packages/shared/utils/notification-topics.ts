/**
 * The notification topic taxonomy, server side.
 *
 * Mirrors the Flutter client at
 * `BISO-Flutter/lib/core/constants/notification_topics.dart`. The two must
 * agree — a topic id built here that the app never subscribed to reaches
 * nobody, silently. A change in one needs the same change in the other. That
 * includes the `_no`/`_en` language suffix (see `localizedTopicId`): the
 * Flutter mirror must add it too.
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

/** The languages a push channel is split by. */
export const PUSH_LOCALES = ["no", "en"] as const;

export type PushLocale = (typeof PUSH_LOCALES)[number];

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
 * `resolveAnnouncementTopicId` below), so a previously sent row
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

/** The language-specific variant of a channel, e.g. `events_bergen_no`. */
export function localizedTopicId(channel: string, locale: PushLocale): string {
  return `${channel}_${locale}`;
}

/**
 * The channel a broadcast goes to: `general_{slug}` for a real campus (1-4),
 * plain `general` (everyone) for National, no campus or an unknown campus.
 */
export function broadcastChannelFor(campusId?: string | null): string {
  const slug = campusSlugFor(campusId);
  if (slug === NATIONAL_SLUG) {
    return GENERAL_TOPIC_ID;
  }
  return `${GENERAL_TOPIC_ID}_${slug}`;
}

/**
 * Resolve a TOPIC announcement's stored `audience_value` to the Appwrite
 * topic id to push to.
 *
 * The composer only ever offers the four logical topics (`news`, `events`,
 * `jobs`, `shop`); this expands one to its campus-scoped id the same way
 * event publishing already does (`topicIdFor` in `_actions/events.ts`), so a
 * manually sent topic announcement reaches the students who actually
 * subscribed instead of a topic id that no longer exists.
 *
 * Rules, in order:
 *  - empty or whitespace-only → `GENERAL_TOPIC_ID` (matches the previous
 *    broadcast fallback for an unset value).
 *  - the retired `products` alias → treated as `shop`, so a row scheduled
 *    before this taxonomy shipped doesn't silently target a dead topic.
 *  - a logical topic → expanded via `topicIdFor`, scoped to `campusId` (a
 *    `null` campus resolves to the national scope of that topic).
 *  - anything else → returned unchanged. Covers values that are already full
 *    topic ids, such as `events_oslo` written by event publishing, and the
 *    bare `general` topic.
 *
 * Lives here, not in the admin `send.ts`, so it stays free of `server-only`
 * and can be tested against the real rules even where suites mock `send.ts`
 * wholesale.
 */
export function resolveAnnouncementTopicId(
  audienceValue: string | null | undefined,
  campusId: string | null | undefined
): string {
  const trimmed = audienceValue?.trim();
  if (!trimmed) {
    return GENERAL_TOPIC_ID;
  }

  const legacyAlias = trimmed === "products" ? "shop" : trimmed;
  if (isNotificationTopic(legacyAlias)) {
    return topicIdFor(legacyAlias, campusId);
  }

  return trimmed;
}

/**
 * The channel an announcement's audience maps to, or `null` when the audience
 * is people (users, segments) rather than a topic.
 */
export function resolvePushChannel(
  audienceType: string,
  audienceValue: string | null | undefined,
  campusId: string | null | undefined
): string | null {
  if (audienceType === "topic") {
    return resolveAnnouncementTopicId(audienceValue, campusId);
  }
  if (audienceType === "broadcast") {
    return broadcastChannelFor(campusId);
  }
  return null;
}

const CAMPUS_SLUG_VALUES = Object.values(CAMPUS_SLUGS);
const REAL_CAMPUS_SLUGS = CAMPUS_SLUG_VALUES.filter(
  (slug) => slug !== NATIONAL_SLUG
);

/**
 * Every language-specific topic id: `general`, `general_{campus}` and each
 * `{topic}_{campus|national}`, in each language. Derived from the constants
 * above so it cannot drift from them.
 */
export const ALL_PUSH_TOPIC_IDS: readonly string[] = PUSH_LOCALES.flatMap(
  (locale) =>
    [
      GENERAL_TOPIC_ID,
      ...REAL_CAMPUS_SLUGS.map((slug) => `${GENERAL_TOPIC_ID}_${slug}`),
      ...NOTIFICATION_TOPICS.flatMap((topic) =>
        CAMPUS_SLUG_VALUES.map((slug) => `${topic}_${slug}`)
      ),
    ].map((channel) => localizedTopicId(channel, locale))
);
