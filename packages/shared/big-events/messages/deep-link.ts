/**
 * The app link a big event's pushes carry (plan M1). Pure module: the send
 * writes it, Communications history leaves those pushes out (ruling R34) and
 * retention finds them by it.
 */

/** What every big event push link starts with. */
export const BIG_EVENT_DEEP_LINK_PREFIX = "biso://big-event";

/** The link a push about the big event with this slug carries. */
export function bigEventDeepLink(slug: string): string {
  return `${BIG_EVENT_DEEP_LINK_PREFIX}?slug=${encodeURIComponent(slug)}`;
}
