import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getEvent } from "../../_actions/events";
import { listCampuses } from "../../_actions/jobs";
import { EventEditorClient } from "./_components/event-editor-client";

type EventEditorPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EventEditorPage({ params }: EventEditorPageProps) {
  const { id } = await params;
  const t = await getTranslations("adminPortal.events");

  const isNew = id === "new";
  const [event, campuses] = await Promise.all([
    isNew ? null : getEvent(id),
    listCampuses(),
  ]);

  if (!isNew && !event) notFound();

  return (
    <EventEditorClient
      event={event}
      campuses={campuses}
      isNew={isNew}
      labels={{
        back: t("title"),
        titleNo: `${t("fields.title")} (NO)`,
        titleEn: `${t("fields.title")} (EN)`,
        descriptionNo: `${t("fields.description")} (NO)`,
        descriptionEn: `${t("fields.description")} (EN)`,
        startDate: t("fields.startDate"),
        endDate: t("fields.endDate"),
        location: t("fields.location"),
        coverImage: t("fields.coverImage"),
        ticketPrice: t("fields.ticketPrice"),
        ticketUrl: t("fields.ticketUrl"),
        memberOnly: t("fields.memberOnly"),
        campus: "Campus",
        slug: "Slug",
        status: t("fields.status"),
        discard: "Discard",
        saveDraft: "Save Draft",
        publish: "Publish",
        preview: t("preview"),
        saveSuccess: t("saveSuccess"),
        saveError: t("saveError"),
        publishSuccess: t("publishSuccess"),
      }}
    />
  );
}
