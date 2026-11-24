import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { canSeeParticipant } from "@/lib/big-events/access";
import {
  PARTICIPANT_CAMPUS_IDS,
  type ParticipantCampusId,
  toParticipantCampusId,
} from "@/lib/big-events/participant-form";
import { listParticipants } from "../../../_actions/big-event-participants";
import { getBigEvent } from "../../../_actions/big-events";
import type { CampusOption } from "./_components/participant-dialog";
import { ParticipantTable } from "./_components/participant-table";

// "Check memberships" looks up every connected participant in Finago.
export const maxDuration = 300;

/** Someone added by hand starts on the big event's campus, else on no campus when allowed. */
function pickDefaultCampus(
  eventCampus: ParticipantCampusId | null,
  campusIds: ParticipantCampusId[],
  allowsNoCampus: boolean
): ParticipantCampusId | null {
  if (eventCampus && campusIds.includes(eventCampus)) {
    return eventCampus;
  }
  return allowsNoCampus ? null : (campusIds[0] ?? null);
}

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
  const defaultCampusId = pickDefaultCampus(
    toParticipantCampusId(event.campus_id),
    campusIds,
    allowsNoCampus
  );

  return (
    <ParticipantTable
      bigEventId={event.$id}
      campusOptions={campusOptions}
      defaultCampusId={defaultCampusId}
      list={list}
    />
  );
}
