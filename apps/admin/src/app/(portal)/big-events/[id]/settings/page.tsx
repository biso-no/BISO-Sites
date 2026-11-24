import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { canEditBigEventSettings } from "@/lib/big-events/access";
import {
  BIG_EVENT_CAMPUS_IDS,
  bigEventFormInitial,
  toBigEventCampusId,
} from "@/lib/big-events/form-schema";
import { ROLES } from "@/lib/roles";
import { getBigEvent } from "../../../_actions/big-events";
import { BigEventForm } from "../../_components/big-event-form";

interface BigEventSettingsPageProps {
  params: Promise<{ id: string }>;
}

export default async function BigEventSettingsPage({
  params,
}: BigEventSettingsPageProps) {
  const ctx = await requireNavAccess("portal.bigEvents");
  const { id } = await params;
  const found = await getBigEvent(id);
  const campusId = found ? toBigEventCampusId(found.event.campus_id) : null;
  if (!(found && campusId)) {
    notFound();
  }
  if (!canEditBigEventSettings(found.access)) {
    redirect(`/big-events/${id}/participants`);
  }
  const t = await getTranslations("adminPortal.bigEvents");
  // Only global admins may move a big event to another campus.
  const isGlobalAdmin = ctx.roles.includes(ROLES.GLOBAL_ADMIN);
  const campusIds = isGlobalAdmin ? BIG_EVENT_CAMPUS_IDS : [campusId];

  return (
    <BigEventForm
      bigEventId={found.event.$id}
      campusLocked={!isGlobalAdmin}
      campusOptions={campusIds.map((option) => ({
        label: t(`campuses.${option}`),
        value: option,
      }))}
      initial={bigEventFormInitial(found.event, campusId)}
    />
  );
}
