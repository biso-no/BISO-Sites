import {
  GENERAL_TOPIC_ID,
  isNotificationTopic,
  topicIdFor,
} from "@repo/shared/utils/notification-topics";

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
 * Kept out of `send.ts` deliberately. That module is `server-only`, and the
 * server-action suites replace it wholesale with `mock.module` — which bun
 * applies to the whole test process, not one file. Anything that must be
 * tested against these real rules therefore needs them in a module no suite
 * mocks.
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
