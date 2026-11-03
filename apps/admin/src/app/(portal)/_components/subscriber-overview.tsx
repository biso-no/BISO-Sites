import { ArrowRight, BellRing } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import type { AudienceContext } from "@/lib/announcements/audience-policy";
import { CAMPUS_ID_TO_NAME } from "@/lib/campus-constants";
import {
  type OverviewColumn,
  overviewChannels,
  subscriberOverviewGrid,
} from "@/lib/notifications/subscriber-overview";
import { getChannelSubscriberCounts } from "@/lib/notifications/topic-subscribers";
import { SERIF_STACK, STUDIO, StudioPanel } from "./studio";

const HEADER_CELL =
  "px-4 py-3 font-medium text-[11px] uppercase tracking-[0.06em]";
const SKELETON_ROWS = ["everyone", "news", "events", "jobs", "shop"] as const;
const COMMUNICATIONS_LINK = (label: string) => ({
  href: "/communications",
  label,
});

function PanelHeading({
  description,
  eyebrow,
  link,
  title,
}: {
  description: string;
  eyebrow: string;
  link?: { href: string; label: string };
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3 p-6 pb-4 md:flex-row md:items-end md:justify-between md:p-7 md:pb-4">
      <div>
        <p
          className="flex items-center gap-2 font-medium text-[11px] uppercase tracking-[0.08em]"
          style={{ color: STUDIO.claret }}
        >
          <BellRing size={12} />
          {eyebrow}
        </p>
        <h2
          className="mt-1 text-3xl"
          style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
        >
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-sm" style={{ color: STUDIO.ink3 }}>
          {description}
        </p>
      </div>
      {link && (
        <Link
          className="flex shrink-0 items-center gap-1.5 text-sm"
          href={link.href}
          style={{ color: STUDIO.claret }}
        >
          {link.label}
          <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}

/**
 * How many phones each push channel reaches, as a topic-by-campus table.
 * Campus admins see their own campuses plus the all-campuses "Everyone"
 * count; global admins see every cell. Renders nothing for anyone else.
 */
export async function SubscriberOverview({ ctx }: { ctx: AudienceContext }) {
  const grid = subscriberOverviewGrid(ctx);
  if (grid.rows.length === 0) {
    return null;
  }

  const [t, format, counts] = await Promise.all([
    getTranslations("adminPortal.dashboard.subscribers"),
    getFormatter(),
    getChannelSubscriberCounts(overviewChannels(grid)),
  ]);

  const columnLabel = (column: OverviewColumn) =>
    column === null ? t("allCampuses") : (CAMPUS_ID_TO_NAME[column] ?? column);

  const cell = (channel: string | null) => {
    if (channel === null) {
      return <span className="sr-only">{t("notShown")}</span>;
    }
    const count = counts[channel] ?? null;
    if (count === null) {
      return (
        <span style={{ color: STUDIO.ink4 }} title={t("unavailable")}>
          <span aria-hidden="true">—</span>
          <span className="sr-only">{t("unavailable")}</span>
        </span>
      );
    }
    return format.number(count);
  };

  const hidesCells = grid.rows.some((row) => row.channels.includes(null));

  return (
    <StudioPanel>
      <PanelHeading
        description={t("description")}
        eyebrow={t("eyebrow")}
        link={COMMUNICATIONS_LINK(t("openCommunications"))}
        title={t("title")}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{t("title")}</caption>
          <thead>
            <tr
              className="border-y"
              style={{ borderColor: STUDIO.rule, color: STUDIO.ink3 }}
            >
              <th
                className={`${HEADER_CELL} pl-6 text-left md:pl-7`}
                scope="col"
              >
                {t("topic")}
              </th>
              {grid.columns.map((column) => (
                <th
                  className={`${HEADER_CELL} text-right last:pr-6 md:last:pr-7`}
                  key={column ?? "all"}
                  scope="col"
                >
                  {columnLabel(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => (
              <tr
                className="border-b last:border-b-0"
                key={row.key}
                style={{ borderColor: STUDIO.rule }}
              >
                <th
                  className="py-3 pr-4 pl-6 text-left font-medium md:pl-7"
                  scope="row"
                  style={{ color: STUDIO.ink }}
                >
                  {t(`rows.${row.key}`)}
                </th>
                {row.channels.map((channel, index) => (
                  <td
                    className="px-4 py-3 text-right tabular-nums last:pr-6 md:last:pr-7"
                    key={grid.columns[index] ?? "all"}
                    style={{ color: STUDIO.ink2 }}
                  >
                    {cell(channel)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hidesCells && (
        <p
          className="border-t px-6 py-3 text-xs md:px-7"
          style={{ borderColor: STUDIO.rule, color: STUDIO.ink4 }}
        >
          {t("scopeNote")}
        </p>
      )}
    </StudioPanel>
  );
}

/** Shown while the counts load, so the rest of the dashboard isn't held up. */
export function SubscriberOverviewSkeleton() {
  const t = useTranslations("adminPortal.dashboard.subscribers");
  return (
    <StudioPanel>
      <PanelHeading
        description={t("description")}
        eyebrow={t("eyebrow")}
        link={COMMUNICATIONS_LINK(t("openCommunications"))}
        title={t("title")}
      />
      {/* Sized like the table (a header row and five rows) so it doesn't jump. */}
      <div aria-busy="true" aria-label={t("loading")} role="status">
        <div className="h-10 border-y" style={{ borderColor: STUDIO.rule }} />
        {SKELETON_ROWS.map((key) => (
          <div
            className="flex h-11 items-center border-b px-6 last:border-b-0 md:px-7"
            key={key}
            style={{ borderColor: STUDIO.rule }}
          >
            <div
              className="h-4 w-full animate-pulse rounded"
              style={{ background: STUDIO.paper3 }}
            />
          </div>
        ))}
      </div>
    </StudioPanel>
  );
}
