import { Plus } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listEvents } from "../_actions/events";
import { PageHeader } from "../_components/page-header";
import { EventsListClient } from "./_components/events-list-client";

interface EventsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const t = await getTranslations("adminPortal.events");
  const tc = await getTranslations("adminPortal.common");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const events = await listEvents({ page });

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")}>
        <Link
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-sm"
          href="/events/new"
          style={{
            background: "#3DA9E0",
            color: "#001731",
            boxShadow: "0 0 20px rgba(61,169,224,0.25)",
          }}
        >
          <Plus size={15} />
          {t("create")}
        </Link>
      </PageHeader>

      <EventsListClient
        initialEvents={events.rows}
        labels={{
          empty: t("empty"),
          emptyDescription: t("emptyDescription"),
          searchPlaceholder: tc("search"),
          all: tc("all"),
          published: tc("status.published"),
          draft: tc("status.draft"),
          cancelled: tc("status.cancelled"),
          edit: t("actions.edit"),
          delete: t("actions.delete"),
          deleteConfirm: tc("confirmDelete"),
        }}
        page={page}
        total={events.total}
      />
    </div>
  );
}
