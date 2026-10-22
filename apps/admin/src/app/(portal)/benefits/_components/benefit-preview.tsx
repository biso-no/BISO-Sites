import { useTranslations } from "next-intl";
import { useId } from "react";
import type { BoardPartner } from "../../_actions/benefits";
import type { PanelValues } from "../_lib/panel-state";
import { PartnerLogo } from "./partner-logo";

/** The website's card colours: white, slate text, blue accents. */
const WEB = {
  accent: "#1667d4",
  accentBorder: "#93c5fd",
  border: "#e2e8f0",
  muted: "#64748b",
  text: "#0f172a",
} as const;

const WEB_FONT =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

/** The name the card shows when no partner is picked. */
const BISO_NAME = "BISO";

export interface BenefitPreviewProps {
  partner: BoardPartner | null;
  values: Pick<
    PanelValues,
    "descriptionEn" | "descriptionNb" | "redemptionType" | "titleEn" | "titleNb"
  >;
}

/**
 * A member benefit as students see it on the website, updated as the panel
 * is filled in. Norwegian first, English when that is all there is.
 */
export function BenefitPreview({ partner, values }: BenefitPreviewProps) {
  const t = useTranslations("adminPortal.benefits.panel");
  const tBoard = useTranslations("adminPortal.benefits.board");
  // The website's own words for the reveal button.
  const tWebsite = useTranslations("memberPortal.benefits");
  const headingId = useId();

  const title = values.titleNb.trim() || values.titleEn.trim();
  const description =
    values.descriptionNb.trim() || values.descriptionEn.trim();
  let chip: string | null = null;
  if (values.redemptionType === "code" || values.redemptionType === "link") {
    chip = tWebsite("reveal");
  } else if (values.redemptionType === "onsite") {
    chip = t("redeemOnsite");
  }

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border bg-white p-4"
      style={{ borderColor: WEB.border, fontFamily: WEB_FONT }}
    >
      <p
        className="mb-3 font-medium text-[11px] uppercase tracking-[0.06em]"
        id={headingId}
        style={{ color: WEB.muted }}
      >
        {t("preview")}
      </p>
      <div className="flex items-start gap-3">
        <PartnerLogo
          logoUrl={partner?.logo_url ?? null}
          name={partner?.name ?? BISO_NAME}
        />
        <div className="min-w-0 flex-1">
          <p
            className="break-words font-semibold text-[15px] leading-snug"
            style={{ color: title ? WEB.text : WEB.muted }}
          >
            {title || tBoard("untitled")}
          </p>
          {description ? (
            <p
              className="mt-1 line-clamp-3 whitespace-pre-line break-words text-[13px] leading-5"
              style={{ color: WEB.muted }}
            >
              {description}
            </p>
          ) : null}
          {chip ? (
            <span
              className="mt-2.5 inline-flex rounded-md border-[1.5px] border-dashed px-2.5 py-1 font-bold text-xs"
              style={{ borderColor: WEB.accentBorder, color: WEB.accent }}
            >
              {chip}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
