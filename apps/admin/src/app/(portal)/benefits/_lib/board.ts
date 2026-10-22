import {
  BENEFIT_SECTIONS,
  type BenefitSection,
  isBenefitSection,
  NATIONAL_CAMPUS_ID,
} from "@repo/shared/utils/benefit-catalog";
import {
  type BenefitDisplayState,
  benefitDisplayState,
} from "@repo/shared/utils/benefit-visibility";
import type { BoardBenefit, BoardPartner } from "../../_actions/benefits";

export const ENDING_SOON_DAYS = 30;
const MS_PER_DAY = 86_400_000;
const FALLBACK_SECTION: BenefitSection = "member";
/** States students no longer see; these items sort after the live ones. */
const LAPSED_STATES: ReadonlySet<BenefitDisplayState> = new Set([
  "expired",
  "ended",
  "hidden",
]);

export interface BoardItem {
  benefit: BoardBenefit;
  partner: BoardPartner | null;
  state: BenefitDisplayState;
}

export interface BoardSection {
  national: BoardItem[];
  own: BoardItem[];
  section: BenefitSection;
}

function groupRank(item: BoardItem): number {
  return LAPSED_STATES.has(item.state) ? 1 : 0;
}

/**
 * Lapsed items always sort after live ones, so dragging one would only snap
 * back. Live, planned and draft items are the ones that can move.
 */
export function canMoveItem(item: BoardItem): boolean {
  return !LAPSED_STATES.has(item.state);
}

function compareItems(a: BoardItem, b: BoardItem): number {
  return (
    groupRank(a) - groupRank(b) ||
    a.benefit.sort_order - b.benefit.sort_order ||
    a.benefit.$createdAt.localeCompare(b.benefit.$createdAt)
  );
}

function sectionOf(benefit: BoardBenefit): BenefitSection {
  return isBenefitSection(benefit.section) ? benefit.section : FALLBACK_SECTION;
}

export function buildBoardSections(
  benefits: BoardBenefit[],
  partners: BoardPartner[],
  campusId: string,
  now: Date
): BoardSection[] {
  const partnersById = new Map(partners.map((p) => [p.id, p]));
  const sections = new Map<BenefitSection, BoardSection>(
    BENEFIT_SECTIONS.map((section) => [
      section,
      { national: [], own: [], section },
    ])
  );
  const includeNational = campusId !== NATIONAL_CAMPUS_ID;

  for (const benefit of benefits) {
    const isOwn = benefit.campus_id === campusId;
    const isNational =
      includeNational && benefit.campus_id === NATIONAL_CAMPUS_ID;
    const target = sections.get(sectionOf(benefit));
    if (!(target && (isOwn || isNational))) {
      continue;
    }
    const partner = benefit.partner_id
      ? (partnersById.get(benefit.partner_id) ?? null)
      : null;
    const item: BoardItem = {
      benefit,
      partner,
      state: benefitDisplayState(
        benefit,
        partner ? { is_active: partner.is_active } : null,
        now
      ),
    };
    (isOwn ? target.own : target.national).push(item);
  }

  const result = [...sections.values()];
  for (const section of result) {
    section.own.sort(compareItems);
    section.national.sort(compareItems);
  }
  return result;
}

export function summarizeBoard(
  sections: BoardSection[],
  now: Date
): { drafts: number; endingSoon: number; visible: number } {
  const horizon = now.getTime() + ENDING_SOON_DAYS * MS_PER_DAY;
  let drafts = 0;
  let endingSoon = 0;
  let visible = 0;
  for (const { own } of sections) {
    for (const { benefit, state } of own) {
      if (state === "draft") {
        drafts += 1;
      }
      if (state === "visible") {
        visible += 1;
        const end = benefit.publish_end
          ? new Date(benefit.publish_end).getTime()
          : Number.NaN;
        if (end <= horizon) {
          endingSoon += 1;
        }
      }
    }
  }
  return { drafts, endingSoon, visible };
}

export function reorderIds(
  ids: string[],
  activeId: string,
  overId: string
): string[] {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from === -1 || to === -1 || from === to) {
    return ids;
  }
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as string);
  return next;
}

/**
 * The section's whole new order after moving one movable item onto another:
 * the save needs every row, so lapsed items follow in their current order.
 * Null when the move changes nothing.
 */
export function reorderOwnItems(
  own: BoardItem[],
  activeId: string,
  overId: string
): string[] | null {
  const movable = own.filter(canMoveItem).map((item) => item.benefit.$id);
  const next = reorderIds(movable, activeId, overId);
  if (next === movable) {
    return null;
  }
  const lapsed = own
    .filter((item) => !canMoveItem(item))
    .map((item) => item.benefit.$id);
  return [...next, ...lapsed];
}
