"use client";

import type { PublicBenefit } from "@repo/shared/utils/benefit-public";
import { useTranslations } from "next-intl";
import { CardGrid } from "@/components/ui/card-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { BenefitPreviewCard } from "./benefit-preview-card";

const SHOWCASE_LIMIT = 6;

/**
 * A first look at the benefits for someone who is not a member yet. The
 * server already scoped these to the visitor's campus plus national.
 *
 * A grid rather than the old looping carousel, whose off-screen slides
 * reached past the viewport. The "10,000+ active members" tile is gone: the
 * figure never came from data (01-design-spec.md §6, PLACEHOLDER-004), and
 * member numbers are not public. Nothing to show, nothing rendered.
 */
export function BenefitsShowcase({ benefits }: { benefits: PublicBenefit[] }) {
  const t = useTranslations("memberPortal.showcase");

  if (benefits.length === 0) {
    return null;
  }

  return (
    <section>
      <SectionHeading>{t("title")}</SectionHeading>
      <p className="type-body-sm mb-8 max-w-(--measure) text-ink-muted">
        {t("description")}
      </p>
      <CardGrid>
        {benefits.slice(0, SHOWCASE_LIMIT).map((benefit) => (
          <li key={benefit.id}>
            <BenefitPreviewCard benefit={benefit} />
          </li>
        ))}
      </CardGrid>
    </section>
  );
}
