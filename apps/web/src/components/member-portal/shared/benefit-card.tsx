"use client";

import type { PublicBenefit } from "@repo/shared/utils/benefit-public";
import { PlateContentRenderer } from "@repo/ui/components/plate-content-renderer";
import { Clock, IdCard, Store } from "lucide-react";
import Image from "next/image";
import {
  createFormatter,
  useLocale,
  useTimeZone,
  useTranslations,
} from "next-intl";
import { useState } from "react";
import { revealBenefit } from "@/app/actions/member-portal";
import { Pill } from "@/components/ui/pill";
import { Prose } from "@/components/ui/prose";
import {
  benefitCategoryLabel,
  localizedPublicBenefitText,
} from "@/lib/benefit-text";
import { CodeReveal, LinkReveal, RevealButton } from "./benefit-card-parts";

interface BenefitCardProps {
  benefit: PublicBenefit;
}

type RevealFailure = Extract<
  Awaited<ReturnType<typeof revealBenefit>>,
  { success: false }
>["reason"];

const REVEAL_ERROR_KEYS: Record<RevealFailure, string> = {
  no_code: "revealErrors.noCode",
  not_found: "revealErrors.generic",
  not_member: "revealErrors.notMember",
  unavailable: "revealErrors.unavailable",
};

const COPIED_FEEDBACK_MS = 2000;

const DATE_LOCALES: Record<string, string> = { en: "en-GB", no: "nb-NO" };
const END_DATE_FORMAT = {
  day: "numeric",
  month: "short",
  year: "numeric",
} as const;

/**
 * "24. des. 2026" / "24 Dec 2026". Formatted by next-intl in the time zone
 * the server hands the provider, so the server render and the browser agree.
 */
function formatEndDate(
  iso: string,
  locale: string,
  timeZone: string | undefined
): string {
  return createFormatter({
    locale: DATE_LOCALES[locale] ?? DATE_LOCALES.en,
    timeZone,
  }).dateTime(new Date(iso), END_DATE_FORMAT);
}

/** Stored HTML or Plate JSON starts with "<" or "["; anything else is text. */
const isRichDescription = (description: string) => {
  const start = description.trimStart().charAt(0);
  return start === "<" || start === "[";
};

/**
 * Older benefits still hold HTML or Plate JSON; newer ones are plain text
 * with line breaks.
 */
function Description({ value }: { value: string }) {
  if (isRichDescription(value)) {
    return (
      <Prose className="type-body-sm [&_p]:type-body-sm mt-4 text-ink-muted [&_p]:mb-2">
        <PlateContentRenderer value={value} />
      </Prose>
    );
  }
  // Optional, so no empty spacer when it's blank.
  return value ? (
    <p className="type-body-sm mt-4 whitespace-pre-line text-ink-muted">
      {value}
    </p>
  ) : null;
}

/** The code or link, behind a reveal the server checks and records. */
function Redemption({ benefit }: { benefit: PublicBenefit }) {
  const t = useTranslations("memberPortal.benefits");
  const [value, setValue] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);

  const handleReveal = async () => {
    if (value !== null || isRevealing) {
      return;
    }

    setIsRevealing(true);
    setErrorKey(null);
    try {
      const result = await revealBenefit(benefit.id);
      if (result.success) {
        setValue(result.value);
      } else {
        setErrorKey(REVEAL_ERROR_KEYS[result.reason]);
      }
    } catch (error) {
      console.error("Failed to reveal benefit:", error);
      setErrorKey(REVEAL_ERROR_KEYS.not_found);
    } finally {
      setIsRevealing(false);
    }
  };

  const handleCopyCode = () => {
    if (value) {
      navigator.clipboard.writeText(value);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), COPIED_FEEDBACK_MS);
    }
  };

  if (value === null) {
    return (
      <>
        <RevealButton
          isRevealing={isRevealing}
          onReveal={handleReveal}
          revealingLabel={t("revealing")}
          revealLabel={t("reveal")}
        />
        {errorKey ? (
          <p className="type-body-sm mt-2 text-danger" role="alert">
            {t(errorKey)}
          </p>
        ) : null}
      </>
    );
  }
  if (benefit.redemptionType === "code") {
    return (
      <CodeReveal
        copiedCode={copiedCode}
        copiedLabel={t("copied")}
        copyLabel={t("copy")}
        onCopy={handleCopyCode}
        value={value}
      />
    );
  }
  return <LinkReveal label={t("activateBenefit")} value={value} />;
}

/**
 * One member benefit. A code or link sits behind a reveal: the card never
 * receives a value the server has not handed this member.
 *
 * Title, description and terms follow the visitor's language and fall back
 * to the other one field by field (`localizedPublicBenefitText`).
 */
export function BenefitCard({ benefit }: BenefitCardProps) {
  const t = useTranslations("memberPortal.benefits");
  const locale = useLocale();
  const timeZone = useTimeZone();
  const text = localizedPublicBenefitText(benefit, locale);
  const categoryLabel = benefitCategoryLabel(benefit.category, locale);
  const expires = benefit.publishEnd
    ? formatEndDate(benefit.publishEnd, locale, timeZone)
    : null;
  const hasReveal =
    benefit.redemptionType === "code" || benefit.redemptionType === "link";

  return (
    <div className="flex h-full flex-col rounded-biso-md border border-edge p-6">
      <div className="flex items-start gap-4">
        {benefit.partner?.logoUrl ? (
          <div className="relative size-14 shrink-0 overflow-hidden rounded-biso-sm border border-edge bg-surface">
            <Image
              alt={benefit.partner.name}
              className="object-contain"
              fill
              sizes="56px"
              src={benefit.partner.logoUrl}
              unoptimized
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          {categoryLabel ? <Pill>{categoryLabel}</Pill> : null}
          <h3 className="type-heading-card mt-2 break-words text-ink">
            {text.title}
          </h3>
          {benefit.partner ? (
            <p className="type-body-sm mt-1 flex items-center gap-1.5 text-ink-muted">
              <Store aria-hidden="true" className="size-3.5 shrink-0" />
              {benefit.partner.name}
            </p>
          ) : null}
        </div>
      </div>

      {benefit.imageUrl ? (
        <div className="relative mt-4 h-36 w-full overflow-hidden rounded-biso-sm">
          <Image
            alt=""
            className="object-cover"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            src={benefit.imageUrl}
            unoptimized
          />
        </div>
      ) : null}

      <Description value={text.description} />

      {benefit.redemptionType === "onsite" ? (
        <p className="type-body-sm mt-5 flex items-center gap-2 rounded-biso-sm bg-surface-sunken p-3 text-ink">
          <IdCard aria-hidden="true" className="size-4 shrink-0" />
          {t("onsite")}
        </p>
      ) : null}

      {hasReveal ? (
        <div className="mt-5">
          <Redemption benefit={benefit} />
        </div>
      ) : null}

      {text.terms || expires ? (
        <div className="mt-auto flex flex-col gap-2 pt-5">
          {text.terms ? (
            <p className="type-body-sm rounded-biso-sm bg-surface-sunken p-3 text-ink-muted">
              <strong className="font-semibold text-ink">{t("terms")}</strong>{" "}
              {text.terms}
            </p>
          ) : null}
          {expires ? (
            <p className="type-body-sm flex items-center gap-2 text-warning">
              <Clock aria-hidden="true" className="size-3.5 shrink-0" />
              {t("expires", { date: expires })}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
