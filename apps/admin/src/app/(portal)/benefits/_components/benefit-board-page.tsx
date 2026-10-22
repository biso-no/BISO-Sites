import {
  isBenefitSection,
  NATIONAL_CAMPUS_ID,
} from "@repo/shared/utils/benefit-catalog";
import { campusIdToLabel } from "@repo/shared/utils/unit-urls";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { benefitAccessFor, canEditBenefitCampus } from "@/lib/benefit-access";
import {
  BENEFIT_BOARD_CAMPUS_COOKIE,
  orderBoardCampuses,
  resolveBoardCampus,
} from "@/lib/benefits/board-campus";
import { listBenefitPartners } from "../../_actions/benefit-partners";
import {
  type BenefitEditData,
  type BoardPartner,
  getBenefitForEdit,
  loadBenefitBoard,
} from "../../_actions/benefits";
import { listCampuses } from "../../_actions/lookups";
import { StudioLinkButton, StudioPageHeader } from "../../_components/studio";
import {
  type AdminLocale,
  boardHref,
  newBenefitHref,
} from "../_lib/board-display";
import { BOARD_FOCUS_RING } from "../_lib/board-styles";
import {
  emptyPanelValues,
  NEW_BENEFIT_ID,
  type PanelValues,
  panelKey,
  panelValuesFromBenefit,
  withPresetPartner,
} from "../_lib/panel-state";
import { BenefitBoard } from "./benefit-board";
import { BenefitCampusTabs, type BoardCampusTab } from "./benefit-campus-tabs";
import { BenefitPanel } from "./benefit-panel";

export interface BenefitBoardPageProps {
  /** The `campus` search param. */
  campus?: string;
  /** A partner a new member benefit starts with (`?partner=`). */
  newPartnerId?: string;
  /** The section a new benefit starts in. */
  newSection?: string;
  /** The benefit open in the side panel, or `"new"`. */
  openId?: string;
}

/**
 * The benefits board for one campus tab. `openId` opens a benefit, or an
 * empty one, in the side panel over the board; closing it returns here.
 */
export async function BenefitBoardPage({
  campus,
  newPartnerId,
  newSection,
  openId,
}: BenefitBoardPageProps) {
  const ctx = await requireNavAccess("portal.benefits");
  const access = benefitAccessFor(ctx);
  const isNew = openId === NEW_BENEFIT_ID;
  const opened = openId && !isNew ? await getBenefitForEdit(openId) : null;
  if (openId && !(isNew || opened)) {
    notFound();
  }

  const cookieStore = await cookies();
  const campusId = resolveBoardCampus({
    editableCampusIds: access.editableCampusIds,
    remembered: cookieStore.get(BENEFIT_BOARD_CAMPUS_COOKIE)?.value,
    // A direct link to a benefit opens the tab it belongs to.
    requested: campus ?? opened?.campus_id,
    visibleCampusIds: access.visibleCampusIds,
  });
  if (!campusId) {
    notFound();
  }
  if (isNew && !canEditBenefitCampus(access, campusId)) {
    redirect(boardHref(campusId));
  }
  const panelCampusId = opened?.campus_id ?? campusId;

  const [data, campuses, t, uiLocale, panelPartners] = await Promise.all([
    loadBenefitBoard(campusId),
    // Only the tab labels come from here; without them the labels fall back
    // to the built-in campus names rather than taking the board down.
    listCampuses().catch(() => []),
    getTranslations("adminPortal.benefits.board"),
    getLocale(),
    openId ? listBenefitPartners(panelCampusId) : Promise.resolve([]),
  ]);
  const locale: AdminLocale = uiLocale === "en" ? "en" : "no";
  const campusNames = new Map(campuses.map((row) => [row.$id, row.name]));
  const campusLabel = (id: string): string =>
    id === NATIONAL_CAMPUS_ID
      ? t("nationalTab")
      : (campusNames.get(id) ?? campusIdToLabel(id) ?? "");
  const tabs: BoardCampusTab[] = orderBoardCampuses(
    access.visibleCampusIds
  ).map((id) => ({ id, label: campusLabel(id) }));

  const panel = openId ? (
    <BenefitPanel
      benefitId={opened?.$id ?? null}
      boardHref={boardHref(campusId)}
      campusLabel={campusLabel(panelCampusId)}
      editable={opened ? opened.editable : true}
      initial={panelInitialValues({
        campusId,
        newPartnerId,
        newSection,
        opened,
        partners: panelPartners,
      })}
      key={panelKey({ campusId, newPartnerId, newSection, openId })}
      locale={locale}
      partners={pickerPartners(panelPartners, data.partners, opened)}
    />
  ) : null;

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

      <BenefitBoard
        access={access}
        data={data}
        locale={locale}
        // One clock for the server render and the browser, so a benefit that
        // starts or ends right now shows the same state on both.
        now={new Date().toISOString()}
        open={panel}
      />
    </div>
  );
}

function panelInitialValues({
  campusId,
  newPartnerId,
  newSection,
  opened,
  partners,
}: {
  campusId: string;
  newPartnerId?: string;
  newSection?: string;
  opened: BenefitEditData | null;
  partners: BoardPartner[];
}): PanelValues {
  if (opened) {
    return panelValuesFromBenefit(opened);
  }
  const section = isBenefitSection(newSection) ? newSection : "member";
  return withPresetPartner(
    emptyPanelValues(section, campusId),
    newPartnerId,
    partners
  );
}

/**
 * The partners the picker offers. A benefit still linked to a partner from
 * outside that list (saved before partners were scoped) keeps showing it,
 * so the panel never pretends it has no partner.
 */
function pickerPartners(
  partners: BoardPartner[],
  boardPartners: BoardPartner[],
  opened: BenefitEditData | null
): BoardPartner[] {
  const linked = opened?.partner_id;
  if (!linked || partners.some((partner) => partner.id === linked)) {
    return partners;
  }
  return [
    ...partners,
    ...boardPartners.filter((partner) => partner.id === linked),
  ];
}
