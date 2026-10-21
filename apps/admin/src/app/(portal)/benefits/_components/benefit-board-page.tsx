import { NATIONAL_CAMPUS_ID } from "@repo/shared/utils/benefit-catalog";
import { campusIdToLabel } from "@repo/shared/utils/unit-urls";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { benefitAccessFor } from "@/lib/benefit-access";
import {
  BENEFIT_BOARD_CAMPUS_COOKIE,
  orderBoardCampuses,
  resolveBoardCampus,
} from "@/lib/benefits/board-campus";
import { loadBenefitBoard } from "../../_actions/benefits";
import { listCampuses } from "../../_actions/lookups";
import { StudioLinkButton, StudioPageHeader } from "../../_components/studio";
import { type AdminLocale, newBenefitHref } from "../_lib/board-display";
import { BOARD_FOCUS_RING } from "../_lib/board-styles";
import { BenefitBoard } from "./benefit-board";
import { BenefitCampusTabs, type BoardCampusTab } from "./benefit-campus-tabs";

export interface BenefitBoardPageProps {
  /** The `campus` search param. */
  campus?: string;
  /** The section a new benefit starts in. */
  newSection?: string;
  /** The benefit open in the side panel, or `"new"`. */
  openId?: string | "new";
}

/**
 * The benefits board for one campus tab. `openId` and `newSection` choose
 * what the side panel shows; the board renders the same either way.
 */
export async function BenefitBoardPage({ campus }: BenefitBoardPageProps) {
  const ctx = await requireNavAccess("portal.benefits");
  const access = benefitAccessFor(ctx);
  const cookieStore = await cookies();
  const campusId = resolveBoardCampus({
    editableCampusIds: access.editableCampusIds,
    remembered: cookieStore.get(BENEFIT_BOARD_CAMPUS_COOKIE)?.value,
    requested: campus,
    visibleCampusIds: access.visibleCampusIds,
  });
  if (!campusId) {
    notFound();
  }

  const [data, campuses, t, uiLocale] = await Promise.all([
    loadBenefitBoard(campusId),
    listCampuses(),
    getTranslations("adminPortal.benefits.board"),
    getLocale(),
  ]);
  const locale: AdminLocale = uiLocale === "en" ? "en" : "no";
  const campusNames = new Map(campuses.map((row) => [row.$id, row.name]));
  const tabs: BoardCampusTab[] = orderBoardCampuses(
    access.visibleCampusIds
  ).map((id) => ({
    id,
    label:
      id === NATIONAL_CAMPUS_ID
        ? t("nationalTab")
        : (campusNames.get(id) ?? campusIdToLabel(id) ?? ""),
  }));

  return (
    <div className="pb-16">
      <StudioPageHeader eyebrow={t("eyebrow")} title={t("title")}>
        <StudioLinkButton
          className={BOARD_FOCUS_RING}
          href="/benefits/partners"
        >
          {t("partners")}
        </StudioLinkButton>
        {data.editable ? (
          <StudioLinkButton
            className={BOARD_FOCUS_RING}
            href={newBenefitHref(campusId, "member")}
            variant="accent"
          >
            {t("newBenefit")}
          </StudioLinkButton>
        ) : null}
      </StudioPageHeader>

      <BenefitCampusTabs
        current={campusId}
        label={t("campusTabs")}
        tabs={tabs}
      />

      <BenefitBoard access={access} data={data} locale={locale} />
    </div>
  );
}
