import type { GroupKind } from "@repo/shared/big-events/tables";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { canSeeParticipant } from "@/lib/big-events/access";
import {
  defaultParticipantCampus,
  PARTICIPANT_CAMPUS_IDS,
  toParticipantCampusId,
} from "@/lib/big-events/participant-form";
import { getBigEvent } from "../../../../_actions/big-events";
import { SERIF_STACK, STUDIO } from "../../../../_components/studio";
import type { CampusChoice } from "./_components/column-mapping";
import { ImportWizard } from "./_components/import-wizard";

// Saving a large list writes every person, room and place, then links accounts.
export const maxDuration = 300;

interface ImportParticipantsPageProps {
  params: Promise<{ id: string }>;
}

export default async function ImportParticipantsPage({
  params,
}: ImportParticipantsPageProps) {
  await requireNavAccess("portal.bigEvents");
  const { id } = await params;
  const found = await getBigEvent(id);
  if (!found) {
    notFound();
  }
  const { access, event } = found;
  const t = await getTranslations("adminPortal.bigEvents");

  // Only campuses the caller may import; "No campus" only when they'd still see those people.
  const campusIds = PARTICIPANT_CAMPUS_IDS.filter((campusId) =>
    canSeeParticipant(access, { campus_id: campusId })
  );
  const allowsNoCampus = canSeeParticipant(access, { campus_id: null });
  const campusChoices: CampusChoice[] = [
    ...(allowsNoCampus
      ? [{ label: t("import.columns.campusNone"), value: null }]
      : []),
    ...campusIds.map((campusId) => ({
      label: t(`campuses.${campusId}`),
      value: campusId,
    })),
  ];
  const groupKinds: GroupKind[] = [
    "room",
    ...(event.travel_enabled ? (["bus"] as const) : []),
    "buddy",
    "team",
  ];

  return (
    <div className="max-w-5xl">
      <Link
        className="mb-4 inline-flex items-center gap-1.5 font-medium text-[11px] uppercase tracking-[0.08em]"
        href={`/big-events/${event.$id}/participants`}
        style={{ color: STUDIO.claret }}
      >
        <ArrowLeft aria-hidden size={12} />
        {t("import.backToParticipants")}
      </Link>
      <h2
        className="text-3xl leading-tight"
        style={{ color: STUDIO.ink, fontFamily: SERIF_STACK, fontWeight: 400 }}
      >
        {t("import.title")}
      </h2>
      <p className="mt-2 mb-6 text-sm leading-6" style={{ color: STUDIO.ink3 }}>
        {t("import.description")}
      </p>
      <ImportWizard
        bigEventId={event.$id}
        campusChoices={campusChoices}
        defaultCampusId={defaultParticipantCampus(
          toParticipantCampusId(event.campus_id),
          campusIds,
          allowsNoCampus
        )}
        groupKinds={groupKinds}
      />
    </div>
  );
}
