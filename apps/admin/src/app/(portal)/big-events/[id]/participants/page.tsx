import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { canSeeParticipant } from "@/lib/big-events/access";
import {
  defaultParticipantCampus,
  PARTICIPANT_CAMPUS_IDS,
  toParticipantCampusId,
} from "@/lib/big-events/participant-form";
import { listParticipants } from "../../../_actions/big-event-participants";
import { getBigEvent } from "../../../_actions/big-events";
import type { CampusOption } from "./_components/participant-dialog";
import { ParticipantTable } from "./_components/participant-table";

// "Check memberships" looks up every connected participant in Finago.
export const maxDuration = 300;

interface BigEventParticipantsPageProps {
  params: Promise<{ id: string }>;
}

export default async function BigEventParticipantsPage({
  params,
}: BigEventParticipantsPageProps) {
  await requireNavAccess("portal.bigEvents");
  const { id } = await params;
  const found = await getBigEvent(id);
  if (!found) {
    notFound();
  }
  const { access, event } = found;
  const [list, t] = await Promise.all([
    listParticipants(id),
    getTranslations("adminPortal.bigEvents"),
  ]);

  // Only campuses the caller may give someone; "No campus" only when they'd still see them.
  const campusIds = PARTICIPANT_CAMPUS_IDS.filter((campusId) =>
    canSeeParticipant(access, { campus_id: campusId })
  );
  const allowsNoCampus = canSeeParticipant(access, { campus_id: null });
  const campusOptions: CampusOption[] = [
    ...(allowsNoCampus
      ? [{ label: t("participants.noCampusOption"), value: "" }]
      : []),
    ...campusIds.map((campusId) => ({
      label: t(`campuses.${campusId}`),
      value: campusId,
    })),
  ];
  const defaultCampusId = defaultParticipantCampus(
    toParticipantCampusId(event.campus_id),
    campusIds,
    allowsNoCampus
  );

  return (
    <ParticipantTable
      bigEventId={event.$id}
      campusOptions={campusOptions}
      defaultCampusId={defaultCampusId}
      isPublished={event.status === "published"}
      list={list}
    />
  );
}
