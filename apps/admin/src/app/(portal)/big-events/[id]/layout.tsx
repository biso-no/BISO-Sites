import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { canEditBigEventSettings } from "@/lib/big-events/access";
import { formatBigEventDates } from "@/lib/big-events/dates";
import { getBigEvent } from "../../_actions/big-events";
import { StudioPageHeader, StudioStatusPill } from "../../_components/studio";
import { BigEventTabs } from "../_components/big-event-tabs";

interface BigEventLayoutProps {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

export default async function BigEventLayout({
  children,
  params,
}: BigEventLayoutProps) {
  const { id } = await params;
  const found = await getBigEvent(id);
  if (!found) {
    notFound();
  }
  const [t, locale] = await Promise.all([
    getTranslations("adminPortal.bigEvents"),
    getLocale(),
  ]);
  const { access, event } = found;
  const status = event.status ?? "draft";
  const name = locale === "en" && event.name_en ? event.name_en : event.name_no;
  const details = [
    t(`campuses.${event.campus_id}`),
    formatBigEventDates(event.starts_at, event.ends_at, locale),
    event.place_name,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <StudioPageHeader
        description={details}
        eyebrow={
          <Link className="flex items-center gap-1.5" href="/big-events">
            <ArrowLeft aria-hidden size={12} />
            {t("backToList")}
          </Link>
        }
        title={name}
      >
        <StudioStatusPill
          label={t(`status.${status}`)}
          size="md"
          status={status}
        />
      </StudioPageHeader>
      <BigEventTabs
        bigEventId={event.$id}
        labels={{
          groups: t("tabs.groups"),
          participants: t("tabs.participants"),
          settings: t("tabs.settings"),
        }}
        showSettings={canEditBigEventSettings(access)}
      />
      {children}
    </div>
  );
}
