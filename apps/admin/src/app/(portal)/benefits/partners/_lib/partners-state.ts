import {
  type BenefitDisplayState,
  benefitDisplayState,
} from "@repo/shared/utils/benefit-visibility";
import type {
  PartnerDeal,
  PartnerWithDeals,
} from "../../../_actions/benefit-partners";
import type { SiteLogoGroup } from "../../../_actions/site-logos";
import { reorderIds } from "../../_lib/board";

export interface PartnerCard {
  dealStates: { deal: PartnerDeal; state: BenefitDisplayState }[];
  ended: boolean;
  partner: PartnerWithDeals;
}

/** The campus chip that shows every partner. */
export const ALL_CAMPUSES = "all";

/** The cards on screen: one campus or `ALL_CAMPUSES`, ended ones or not. */
export interface PartnerFilter {
  campusId: string;
  showEnded: boolean;
}

const COLLATION_LOCALE = "nb";

export function buildPartnerCards(
  partners: PartnerWithDeals[],
  filter: PartnerFilter,
  now: Date
): PartnerCard[] {
  return partners
    .filter(
      (p) =>
        (filter.campusId === ALL_CAMPUSES || p.campus_id === filter.campusId) &&
        (filter.showEnded || p.is_active !== false)
    )
    .sort((a, b) => a.name.localeCompare(b.name, COLLATION_LOCALE))
    .map((partner) => ({
      dealStates: [...partner.deals]
        .sort((a, b) => a.title_nb.localeCompare(b.title_nb, COLLATION_LOCALE))
        .map((deal) => ({
          deal,
          state: benefitDisplayState(
            deal,
            { is_active: partner.is_active },
            now
          ),
        })),
      ended: partner.is_active === false,
      partner,
    }));
}

export function publishedDealCount(partner: PartnerWithDeals): number {
  return partner.deals.filter((d) => d.status === "published").length;
}

/** The partner's offers students see right now: what ending it takes away. */
export function visibleDealCount(card: PartnerCard): number {
  return card.dealStates.filter(({ state }) => state === "visible").length;
}

export function moveLogo(
  group: SiteLogoGroup,
  activeId: string,
  overId: string
): SiteLogoGroup {
  const order = reorderIds(
    group.logos.map((l) => l.id),
    activeId,
    overId
  );
  const byId = new Map(group.logos.map((l) => [l.id, l]));
  return {
    ...group,
    logos: order.flatMap((id) => {
      const logo = byId.get(id);
      return logo ? [logo] : [];
    }),
  };
}
