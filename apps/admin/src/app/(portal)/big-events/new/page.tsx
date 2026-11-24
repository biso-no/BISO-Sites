import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { canCreateBigEvent } from "@/lib/big-events/access";
import {
  BIG_EVENT_CAMPUS_IDS,
  emptyBigEventForm,
} from "@/lib/big-events/form-schema";
import { StudioPageHeader } from "../../_components/studio";
import { BigEventForm } from "../_components/big-event-form";

export default async function NewBigEventPage() {
  const ctx = await requireNavAccess("portal.bigEvents");
  const t = await getTranslations("adminPortal.bigEvents");
  const campusIds = BIG_EVENT_CAMPUS_IDS.filter((campusId) =>
    canCreateBigEvent(ctx, campusId)
  );
  const defaultCampus =
    campusIds.find((campusId) => campusId === ctx.activeCampusId) ??
    campusIds[0];
  if (!defaultCampus) {
    notFound();
  }

  return (
    <div>
      <StudioPageHeader
        description={t("newPage.description")}
        eyebrow={
          <Link className="flex items-center gap-1.5" href="/big-events">
            <ArrowLeft aria-hidden size={12} />
            {t("backToList")}
          </Link>
        }
        title={t("newPage.title")}
      />
      <BigEventForm
        campusLocked={false}
        campusOptions={campusIds.map((campusId) => ({
          label: t(`campuses.${campusId}`),
          value: campusId,
        }))}
        initial={emptyBigEventForm(defaultCampus)}
      />
    </div>
  );
}
