import { formatOsloDate } from "@repo/shared/utils/oslo-time";
import type { MessageLocale } from "@/lib/big-events/messages/draft";

const DAY: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  weekday: "short",
};
const TIME: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
};

/**
 * A message's time in Oslo, as the bus details write it (plan M5):
 * "Thu 21 Jan, 09:00" / "tor. 21. jan. kl. 09:00". Empty when unreadable.
 */
export function formatWhen(
  iso: string | null | undefined,
  locale: MessageLocale
): string {
  const tag = locale === "no" ? "nb-NO" : "en-GB";
  const day = formatOsloDate(iso, DAY, tag);
  const time = formatOsloDate(iso, TIME, tag);
  if (!(day && time)) {
    return "";
  }
  return locale === "no" ? `${day} kl. ${time}` : `${day}, ${time}`;
}
