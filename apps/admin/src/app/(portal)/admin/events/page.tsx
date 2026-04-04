import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Plus, Calendar } from "lucide-react";
import { listEvents } from "../_actions/events";
import { PageHeader } from "../_components/page-header";
import { EventsListClient } from "./_components/events-list-client";

export default async function EventsPage() {
  const t = await getTranslations("adminPortal.events");
  const tc = await getTranslations("adminPortal.common");

  const events = await listEvents();
  console.log("Fetched events:", events);

  if (!events || events.total === 0) {
    return (
      <div className="pb-12">
        <PageHeader title={t("title")} description={t("description")}>
          <Link
            href="/admin/events/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "#3DA9E0", color: "#001731", boxShadow: "0 0 20px rgba(61,169,224,0.25)" }}
          >
            <Plus size={15} />
            {t("create")}
          </Link>
        </PageHeader>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Failed to load events.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <PageHeader title={t("title")} description={t("description")}>
        <Link
          href="/admin/events/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: "#3DA9E0", color: "#001731", boxShadow: "0 0 20px rgba(61,169,224,0.25)" }}
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
      />
    </div>
  );
}
