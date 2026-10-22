import { NATIONAL_CAMPUS_ID } from "@repo/shared/utils/benefit-catalog";
import { campusIdToLabel } from "@repo/shared/utils/unit-urls";
import { getLocale, getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import {
  BOARD_CAMPUS_ORDER,
  orderBoardCampuses,
} from "@/lib/benefits/board-campus";
import { loadPartnersPage } from "../../_actions/benefit-partners";
import { listCampuses } from "../../_actions/lookups";
import type { AdminLocale } from "../_lib/board-display";
import { PartnersPage, type PartnersTab } from "./_components/partners-page";
import { parsePartnerFilter } from "./_lib/partners-state";

type SearchParams = Record<string, string | string[] | undefined>;

const single = (value: string | string[] | undefined): string | undefined =>
  typeof value === "string" ? value : undefined;

/**
 * Fordeler → Partnere. `?tab=deals|logos` picks the tab (deals first);
 * `?campus=` and `?ended=1` set the deal partners' filter.
 */
export default async function BenefitPartnersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireNavAccess("portal.benefitsPartners");
  const [query, data, campuses, t, uiLocale] = await Promise.all([
    searchParams,
    loadPartnersPage(),
    // Only the campus names come from here; without them the page falls
    // back to the built-in names rather than going down.
    listCampuses().catch(() => []),
    getTranslations("adminPortal.benefits.board"),
    getLocale(),
  ]);
  const locale: AdminLocale = uiLocale === "en" ? "en" : "no";
  const names = new Map(campuses.map((row) => [row.$id, row.name]));
  const campusLabels = Object.fromEntries(
    BOARD_CAMPUS_ORDER.map((id) => [
      id,
      id === NATIONAL_CAMPUS_ID
        ? t("nationalTab")
        : (names.get(id) ?? campusIdToLabel(id) ?? ""),
    ])
  );
  const visibleCampusIds = orderBoardCampuses(data.visibleCampusIds);
  const filter = parsePartnerFilter(
    { campus: single(query.campus), ended: single(query.ended) },
    visibleCampusIds
  );
  const tab: PartnersTab = single(query.tab) === "logos" ? "logos" : "deals";

  return (
    <PartnersPage
      deals={{
        campusLabels,
        editableCampusIds: orderBoardCampuses(data.editableCampusIds),
        filter,
        locale,
        // One clock for the server render and the browser, so a deal that
        // starts or ends right now shows the same state on both.
        now: new Date().toISOString(),
        partners: data.partners,
        visibleCampusIds,
      }}
      tab={tab}
    />
  );
}
