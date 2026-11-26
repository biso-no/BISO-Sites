import type { MessageLocale } from "@/lib/big-events/messages/draft";
import type { MessageHistoryItem } from "@/lib/big-events/messages/history";
import { formatWhen } from "./format-when";

/**
 * The plain lines a history entry shows: when, who and how many. Pure
 * module; `t` is `adminPortal.bigEvents.messages`, `campus` names a campus.
 */

type Translate = (
  key: string,
  values?: Record<string, string | number>
) => string;

/** When it went out (only once sent, ruling R11), or when it goes. */
export function whenLine(
  item: MessageHistoryItem,
  locale: MessageLocale,
  t: Translate
): string | null {
  switch (item.status) {
    case "sent":
      return item.sentAt
        ? t("history.sentAt", { when: formatWhen(item.sentAt, locale) })
        : null;
    case "sending":
      return t("history.sendingNow");
    case "failed":
      return item.scheduledAt
        ? t("history.failedAt", { when: formatWhen(item.scheduledAt, locale) })
        : null;
    default:
      return item.scheduledAt
        ? t("history.scheduledAt", {
            when: formatWhen(item.scheduledAt, locale),
          })
        : null;
  }
}

/** Who it was for, without naming anyone (ruling R22). */
export function whoLine(
  item: MessageHistoryItem,
  t: Translate,
  campus: (id: string) => string
): string {
  const { audience } = item;
  switch (audience?.type) {
    case "everyone":
      return t("history.who.everyone");
    case "campus":
      return audience.campusIds.map(campus).join(", ");
    case "groups": {
      const names = [...audience.groupNames];
      if (audience.hiddenGroups > 0) {
        names.push(
          t("history.who.hiddenGroups", { count: audience.hiddenGroups })
        );
      }
      const leg = audience.leg ? ` (${t(`history.who.${audience.leg}`)})` : "";
      return `${names.join(", ")}${leg}`;
    }
    case "people":
      return item.automatic
        ? t("history.who.people", { count: audience.count })
        : t("history.who.chosen", { count: audience.count });
    default:
      return t("history.who.unknown");
  }
}

/** How many it reached: nothing yet while it is planned. */
export function countsLine(
  item: MessageHistoryItem,
  t: Translate
): string | null {
  if (item.status === "scheduled") {
    return null;
  }
  const { email, failed, people, push, sms } = item.counts;
  const parts = [t("history.counts", { email, people, push })];
  if (sms > 0) {
    parts.push(t("history.smsCount", { count: sms }));
  }
  if (failed > 0) {
    parts.push(t("history.failedCount", { count: failed }));
  }
  return parts.join(" · ");
}
