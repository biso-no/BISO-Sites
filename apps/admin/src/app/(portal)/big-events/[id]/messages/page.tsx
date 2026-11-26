import { PLACEHOLDERS } from "@repo/shared/big-events/messages/text";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { canSeeParticipant } from "@/lib/big-events/access";
import { isSmsEnabled } from "@/lib/big-events/messages/send-deps.server";
import { PARTICIPANT_CAMPUS_IDS } from "@/lib/big-events/participant-form";
import { participantName } from "@/lib/big-events/participant-list";
import { listGroups } from "../../../_actions/big-event-groups";
import { listMessages } from "../../../_actions/big-event-messages";
import { listParticipants } from "../../../_actions/big-event-participants";
import { getBigEvent } from "../../../_actions/big-events";
import { MessagesView } from "./_components/messages-view";

// "Send now" and "Try again" send inside the action, row by row, which can
// take minutes for a big audience (ruling R14). A send that outlives this
// is finished by the messages cron.
export const maxDuration = 300;

interface BigEventMessagesPageProps {
  params: Promise<{ id: string }>;
}

/**
 * The Messages tab (spec D6): the composer and the history. Everything it
 * offers comes from the actions, which already limit campus admins to their
 * campus: the people, the groups and the messages they may see.
 */
export default async function BigEventMessagesPage({
  params,
}: BigEventMessagesPageProps) {
  await requireNavAccess("portal.bigEvents");
  const { id } = await params;
  const found = await getBigEvent(id);
  if (!found) {
    notFound();
  }
  const { access, event } = found;
  const travel = Boolean(event.travel_enabled);
  const [history, groupsView, participants, smsEnabled, t] = await Promise.all([
    listMessages(id),
    listGroups(id),
    listParticipants(id),
    isSmsEnabled(),
    getTranslations("adminPortal.bigEvents"),
  ]);

  const campusName = (campusId: string) => t(`campuses.${campusId}`);
  const visibleCampuses = PARTICIPANT_CAMPUS_IDS.filter((campusId) =>
    canSeeParticipant(access, { campus_id: campusId })
  );
  const present = new Set(participants.rows.map((row) => row.campus_id));
  // People with no campus are seen only with access to the whole big event.
  const limitedToCampus = !canSeeParticipant(access, { campus_id: null });
  const groups = groupsView.groups
    .filter((group) => travel || group.kind !== "bus")
    .map((group) => ({
      campusId: group.campus_id,
      id: group.$id,
      kind: group.kind,
      name: group.name,
    }));
  const hasRooms = groups.some((group) => group.kind === "room");
  const placeholders = PLACEHOLDERS.filter((key) => {
    if (key === "first_name") {
      return true;
    }
    return key === "room" ? hasRooms : travel;
  });

  return (
    <MessagesView
      bigEventId={event.$id}
      campuses={visibleCampuses
        .filter((campusId) => present.has(campusId))
        .map((campusId) => ({ id: campusId, label: campusName(campusId) }))}
      everyoneHelp={
        limitedToCampus
          ? t("messages.who.everyoneFrom", {
              campuses: visibleCampuses.map(campusName).join(", "),
            })
          : t("messages.who.everyoneHelp")
      }
      groups={groups}
      history={history.ok ? history.items : []}
      people={participants.rows.map((row) => ({
        campusId: row.campus_id,
        id: row.$id,
        name: participantName(row),
      }))}
      placeholders={placeholders}
      smsEnabled={smsEnabled}
      travel={travel}
    />
  );
}
