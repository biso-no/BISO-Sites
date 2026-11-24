import { Mountain, Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { canCreateBigEvent } from "@/lib/big-events/access";
import { BIG_EVENT_CAMPUS_IDS } from "@/lib/big-events/form-schema";
import { listBigEvents } from "../_actions/big-events";
import { EmptyState } from "../_components/empty-state";
import { StudioLinkButton, StudioPageHeader } from "../_components/studio";
import { BigEventList } from "./_components/big-event-list";

export default async function BigEventsPage() {
  const ctx = await requireNavAccess("portal.bigEvents");
  const [t, locale, items] = await Promise.all([
    getTranslations("adminPortal.bigEvents"),
    getLocale(),
    listBigEvents(),
  ]);
  const canCreate = BIG_EVENT_CAMPUS_IDS.some((campusId) =>
    canCreateBigEvent(ctx, campusId)
  );

  return (
    <div>
      <StudioPageHeader description={t("description")} title={t("title")}>
        {canCreate && (
          <StudioLinkButton href="/big-events/new" variant="primary">
            <Plus aria-hidden size={16} />
            {t("new")}
          </StudioLinkButton>
        )}
      </StudioPageHeader>
      {items.length === 0 ? (
        <EmptyState
          description={t("empty.description")}
          icon={<Mountain aria-hidden size={28} />}
          title={t("empty.title")}
        />
      ) : (
        <BigEventList items={items} locale={locale} />
      )}
    </div>
  );
}
