import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatBigEventDates } from "@/lib/big-events/dates";
import type { BigEventListItem } from "../../_actions/big-events";
import {
  MONO_STACK,
  SERIF_STACK,
  STUDIO,
  StudioCard,
  StudioStatusPill,
} from "../../_components/studio";

interface BigEventListProps {
  items: BigEventListItem[];
  locale: string;
}

export async function BigEventList({ items, locale }: BigEventListProps) {
  const t = await getTranslations("adminPortal.bigEvents");

  return (
    <ul className="grid gap-3">
      {items.map((item) => {
        const name =
          locale === "en" && item.name_en ? item.name_en : item.name_no;
        const status = item.status ?? "draft";
        return (
          <li key={item.$id}>
            <Link
              className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              href={`/big-events/${item.$id}`}
            >
              <StudioCard className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[11px] uppercase tracking-[0.06em]"
                    style={{ color: STUDIO.ink3, fontFamily: MONO_STACK }}
                  >
                    {t(`campuses.${item.campus_id}`)} ·{" "}
                    {formatBigEventDates(item.starts_at, item.ends_at, locale)}
                  </p>
                  <h2
                    className="mt-1 truncate text-2xl leading-tight"
                    style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
                  >
                    {name}
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: STUDIO.ink2 }}>
                    {t("list.participants", { count: item.participantCount })}
                    {" · "}
                    {t("list.connected", { count: item.linkedCount })}
                    {item.access === "campus" && (
                      <span style={{ color: STUDIO.ink4 }}>
                        {" · "}
                        {t("list.ownCampusOnly")}
                      </span>
                    )}
                  </p>
                </div>
                <StudioStatusPill
                  label={t(`status.${status}`)}
                  status={status}
                />
                <ChevronRight
                  aria-hidden
                  className="shrink-0"
                  size={18}
                  style={{ color: STUDIO.ink4 }}
                />
              </StudioCard>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
