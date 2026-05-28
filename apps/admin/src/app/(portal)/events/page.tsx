import type { EventRecord } from "@repo/shared/types/events";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { listEvents } from "../_actions/events";
import { EventStudioDashboard } from "./_components/event-studio-dashboard";

interface EventsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  await requireNavAccess("portal.events");
  const t = await getTranslations("adminPortal.events");
  const tc = await getTranslations("adminPortal.common");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const events = await listEvents({ page });

  return (
    <div>
      <EventStudioDashboard
        initialEvents={events.rows as unknown as EventRecord[]}
        labels={{
          all: t("filters.all"),
          cancelled: t("filters.cancelled"),
          compose: t("create"),
          delete: t("actions.delete"),
          deleteConfirm: tc("confirmDelete"),
          drafts: t("filters.drafts"),
          edit: t("actions.edit"),
          empty: t("empty"),
          emptyDescription: t("emptyDescription"),
          past: t("filters.past"),
          searchPlaceholder: tc("search"),
          upcoming: t("filters.upcoming"),
        }}
        page={page}
        total={events.total}
      />
    </div>
  );
}
