import type { PublicBenefit } from "@repo/shared/utils/benefit-public";
import { Clock } from "lucide-react";
import Image from "next/image";
import { ChevronFrame } from "@/components/ui/chevron-frame";
import {
  benefitDescriptionText,
  isRichBenefitDescription,
  localizedPublicBenefitText,
} from "@/lib/benefit-text";
import { BenefitRichText } from "./benefit-rich-text";

/**
 * One member benefit as the public pages show it: who offers it, what it is,
 * the editor's description and when it ends. Never a code or a link — those
 * live behind the member portal's reveal.
 *
 * `summary` (campus page, `/students`) flattens the description to text and
 * caps it at four lines so a row of cards stays even; the full text is still
 * in the markup. `full` (`/membership`) renders a migrated benefit's HTML as
 * HTML and adds the benefit's image.
 *
 * Hook-free and not async, so the caller's translations arrive as labels.
 */
export interface BenefitSummaryCardProps {
  benefit: PublicBenefit;
  /** "Gjelder til 24. des. 2026": receives the formatted end date. */
  formatValidUntil: (date: string) => string;
  headingLevel?: "h3" | "h4";
  locale: "en" | "no";
  variant?: "full" | "summary";
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Oslo",
  year: "numeric",
};

export function BenefitSummaryCard({
  benefit,
  formatValidUntil,
  headingLevel: Heading = "h4",
  locale,
  variant = "summary",
}: BenefitSummaryCardProps) {
  const text = localizedPublicBenefitText(benefit, locale);
  const { partner } = benefit;
  const validUntil = benefit.publishEnd
    ? new Intl.DateTimeFormat(
        locale === "en" ? "en-GB" : "nb-NO",
        DATE_FORMAT
      ).format(new Date(benefit.publishEnd))
    : null;
  const showsImage = variant === "full" && benefit.imageUrl;

  return (
    <li className="flex h-full min-w-0 flex-col rounded-biso-md border border-edge p-5">
      {showsImage ? (
        <ChevronFrame className="mb-4 bg-surface-sunken" ratio="16/9">
          <Image
            alt=""
            className="object-cover"
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            src={benefit.imageUrl as string}
            unoptimized
          />
        </ChevronFrame>
      ) : null}

      {partner ? (
        <div className="mb-3 flex items-center gap-3">
          {partner.logoUrl ? (
            // The name sits beside it, so the logo itself says nothing new.
            <span className="relative size-10 shrink-0 overflow-hidden rounded-biso-sm border border-edge bg-surface">
              <Image
                alt=""
                className="object-contain p-1"
                fill
                sizes="40px"
                src={partner.logoUrl}
                unoptimized
              />
            </span>
          ) : null}
          <span className="type-label min-w-0 break-words text-ink-muted">
            {partner.name}
          </span>
        </div>
      ) : null}

      <Heading className="type-heading-card break-words text-ink">
        {text.title}
      </Heading>

      <Description text={text.description} variant={variant} />

      {validUntil ? (
        <p className="type-body-sm mt-auto flex items-center gap-1.5 pt-4 text-ink-muted">
          <Clock aria-hidden="true" className="size-3.5 shrink-0" />
          {formatValidUntil(validUntil)}
        </p>
      ) : null}
    </li>
  );
}

function Description({
  text,
  variant,
}: {
  text: string;
  variant: "full" | "summary";
}) {
  if (variant === "full" && isRichBenefitDescription(text)) {
    return <BenefitRichText value={text} />;
  }
  const plain = benefitDescriptionText(text);
  if (!plain) {
    return null;
  }
  return (
    <p
      className={`type-body-sm mt-2 whitespace-pre-line text-ink-muted${
        variant === "summary" ? "line-clamp-4" : ""
      }`}
    >
      {plain}
    </p>
  );
}
