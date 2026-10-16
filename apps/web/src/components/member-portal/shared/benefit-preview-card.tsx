"use client";

import type { CampusBenefits } from "@repo/api/types/appwrite";
import { Lock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Pill } from "@/components/ui/pill";
import { benefitHeadline, localizedBenefitText } from "@/lib/benefit-text";

/**
 * A benefit as a non-member sees it: who offers it and what it is, with the
 * code itself behind membership. The padlock is said in words too.
 *
 * Headed by the partner when there is one, else by the benefit's own title —
 * never by a made-up "Partner".
 */
export function BenefitPreviewCard({ benefit }: { benefit: CampusBenefits }) {
  const t = useTranslations("memberPortal.preview");
  const locale = useLocale();
  const { title } = localizedBenefitText(benefit, locale);
  const heading = benefit.partner_name?.trim() || title;
  const headline = benefitHeadline(benefit, locale);

  return (
    <div className="flex h-full flex-col rounded-biso-md border border-edge p-5">
      <div className="flex items-center justify-between gap-3">
        {benefit.category ? <Pill>{benefit.category}</Pill> : <span />}
        <span className="inline-flex items-center text-ink-muted">
          <Lock aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="sr-only">{t("unlockDescription")}</span>
        </span>
      </div>
      <h3 className="type-heading-card mt-3 break-words text-ink">{heading}</h3>
      {headline && headline !== heading ? (
        <p className="type-body mt-1 break-words font-semibold text-ink-accent">
          {headline}
        </p>
      ) : null}
    </div>
  );
}
