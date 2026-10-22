"use client";

import type { PublicBenefit } from "@repo/shared/utils/benefit-public";
import { Lock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Pill } from "@/components/ui/pill";
import {
  benefitCategoryLabel,
  benefitDescriptionText,
  localizedPublicBenefitText,
} from "@/lib/benefit-text";

/**
 * A benefit as a non-member sees it: who offers it and what it is, with the
 * code itself behind membership. The padlock is said in words too.
 *
 * Headed by the partner when there is one, else by the benefit's own title —
 * never by a made-up "Partner". The description is public; only the code is
 * not, so a short excerpt says what the deal is.
 */
export function BenefitPreviewCard({ benefit }: { benefit: PublicBenefit }) {
  const t = useTranslations("memberPortal.preview");
  const locale = useLocale();
  const { description, title } = localizedPublicBenefitText(benefit, locale);
  const excerpt = benefitDescriptionText(description);
  const categoryLabel = benefitCategoryLabel(benefit.category, locale);
  const heading = benefit.partner?.name.trim() || title;

  return (
    <div className="flex h-full flex-col rounded-biso-md border border-edge p-5">
      <div className="flex items-center justify-between gap-3">
        {categoryLabel ? <Pill>{categoryLabel}</Pill> : <span />}
        <span className="inline-flex items-center text-ink-muted">
          <Lock aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="sr-only">{t("unlockDescription")}</span>
        </span>
      </div>
      <h3 className="type-heading-card mt-3 break-words text-ink">{heading}</h3>
      {heading === title ? null : (
        <p className="type-body mt-1 break-words font-semibold text-ink-accent">
          {title}
        </p>
      )}
      {excerpt ? (
        <p className="type-body-sm mt-2 line-clamp-3 whitespace-pre-line text-ink-muted">
          {excerpt}
        </p>
      ) : null}
    </div>
  );
}
