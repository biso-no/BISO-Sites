import { Lock } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { STUDIO } from "../../../_components/studio";
import { BenefitStatePill } from "../../_components/benefit-state-pill";
import { PartnerLogo } from "../../_components/partner-logo";
import {
  type AdminLocale,
  benefitHref,
  benefitTitle,
} from "../../_lib/board-display";
import { BOARD_FOCUS_RING } from "../../_lib/board-styles";
import { websiteHost } from "../_lib/partner-form";
import type { PartnerCard } from "../_lib/partners-state";

const ENDED_OPACITY = 0.55;

export interface PartnerCardViewProps {
  campusLabel: (campusId: string) => string;
  card: PartnerCard;
  locale: AdminLocale;
  onOpen: () => void;
  /** Campuses whose board the viewer can open, so a deal can link there. */
  visibleCampusIds: readonly string[];
}

/** The board's link to a new member offer with this partner already chosen. */
export function newDealHref(partner: PartnerCard["partner"]): string {
  const params = new URLSearchParams([
    ["campus", partner.campus_id ?? ""],
    ["section", "member"],
    ["partner", partner.id],
  ]);
  return `/benefits/new?${params}`;
}

/**
 * One company behind student deals: who it is, where, and each of its
 * offers with the state students see. An ended partner sits back, with
 * nothing new to add until it starts again.
 */
export function PartnerCardView({
  campusLabel,
  card,
  locale,
  onOpen,
  visibleCampusIds,
}: PartnerCardViewProps) {
  const t = useTranslations("adminPortal.benefits.partnersPage");
  const tBoard = useTranslations("adminPortal.benefits.board");
  const nameId = useId();
  const { ended, partner } = card;
  const campusId = partner.campus_id ?? "";
  const meta = [websiteHost(partner.website_url), campusLabel(campusId)]
    .filter(Boolean)
    .join(" · ");
  const canAddDeal = partner.editable && !ended && Boolean(campusId);

  return (
    <li
      className="h-full"
      style={{ opacity: ended ? ENDED_OPACITY : undefined }}
    >
      <article
        aria-labelledby={nameId}
        className="flex h-full flex-col rounded-xl border border-[#e5dcca] bg-white p-4"
      >
        <div className="flex items-start gap-3">
          <PartnerLogo logoUrl={partner.logo_url} name={partner.name} />
          <div className="min-w-0 flex-1">
            <h2
              className="break-words font-semibold text-[15px] leading-snug"
              id={nameId}
              style={{ color: STUDIO.ink }}
            >
              {partner.name}
            </h2>
            {meta ? (
              <p
                className="mt-0.5 break-words text-[13px] leading-5"
                style={{ color: STUDIO.ink3 }}
              >
                {meta}
              </p>
            ) : null}
          </div>
          {ended ? (
            <span
              className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 font-semibold text-[11px] leading-5"
              style={{ background: "#f6ecd8", color: "#8a6420" }}
            >
              {t("ended")}
            </span>
          ) : null}
        </div>

        {card.dealStates.length > 0 ? (
          <ul className="mt-3">
            {card.dealStates.map(({ deal, state }) => {
              const title = benefitTitle(deal, locale) || tBoard("untitled");
              const elsewhere =
                deal.campus_id === campusId ? "" : campusLabel(deal.campus_id);
              return (
                <li
                  className="flex items-center justify-between gap-3 border-t border-dashed py-1.5 text-[13px] leading-5"
                  key={deal.$id}
                  style={{ borderColor: STUDIO.rule }}
                >
                  <span className="min-w-0">
                    {visibleCampusIds.includes(deal.campus_id) ? (
                      <Link
                        className={`break-words rounded-sm hover:underline ${BOARD_FOCUS_RING}`}
                        href={benefitHref(deal.$id, deal.campus_id)}
                        style={{ color: STUDIO.ink }}
                      >
                        {title}
                      </Link>
                    ) : (
                      <span
                        className="break-words"
                        style={{ color: STUDIO.ink }}
                      >
                        {title}
                      </span>
                    )}
                    {elsewhere ? (
                      <span style={{ color: STUDIO.ink3 }}> · {elsewhere}</span>
                    ) : null}
                  </span>
                  <BenefitStatePill state={state} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p
            className="mt-3 border-t border-dashed pt-2 text-[13px] leading-5"
            style={{ borderColor: STUDIO.rule, color: STUDIO.ink3 }}
          >
            {t("noDeals")}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          {canAddDeal ? (
            <Link
              aria-describedby={nameId}
              className={`-ml-1.5 rounded-md px-1.5 py-1 font-semibold text-[13px] transition-colors hover:bg-[rgba(107,30,30,0.07)] ${BOARD_FOCUS_RING}`}
              href={newDealHref(partner)}
              style={{ color: STUDIO.claret }}
            >
              {t("newDeal")}
            </Link>
          ) : (
            <span />
          )}
          <button
            aria-describedby={nameId}
            className={`-mr-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] transition-colors hover:bg-[#f3eee5] hover:text-[#1a1814] ${BOARD_FOCUS_RING}`}
            onClick={onOpen}
            style={{ color: STUDIO.ink3 }}
            type="button"
          >
            {partner.editable ? null : <Lock aria-hidden size={12} />}
            {partner.editable ? t("edit") : t("view")}
          </button>
        </div>
      </article>
    </li>
  );
}
