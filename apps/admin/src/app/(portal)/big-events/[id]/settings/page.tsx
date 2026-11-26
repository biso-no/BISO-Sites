import { autoTextsFor } from "@repo/shared/big-events/messages/auto";
import { defaultAutoTexts } from "@repo/shared/big-events/messages/text";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { canEditBigEventSettings } from "@/lib/big-events/access";
import { autoTextsForm } from "@/lib/big-events/auto-message-texts";
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
  const { event } = found;

  return (
    <BigEventForm
      // The texts in use (own or default) and the defaults: the parser is
      // server-only (ruling R18).
      autoMessages={{
        defaults: autoTextsForm(defaultAutoTexts),
        texts: autoTextsForm((kind) => autoTextsFor(event, kind)),
      }}
      bigEventId={event.$id}
      campusLocked={!isGlobalAdmin}
      campusOptions={campusIds.map((option) => ({
        label: t(`campuses.${option}`),
        value: option,
      }))}
      initial={{
        ...bigEventFormInitial(event, campusId),
        // Not set means on (plan M9).
        auto_bus_assigned: event.auto_bus_assigned ?? true,
        auto_bus_moved: event.auto_bus_moved ?? true,
        auto_departure_reminder: event.auto_departure_reminder ?? true,
      }}
    />
  );
}
