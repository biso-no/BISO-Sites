"use client";

import type { CampusBenefits } from "@repo/api/types/appwrite";
import { PlateContentRenderer } from "@repo/ui/components/plate-content-renderer";
import { Clock, Store } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { revealBenefit } from "@/app/actions/member-portal";
import { Pill } from "@/components/ui/pill";
import { Prose } from "@/components/ui/prose";
import { localizedBenefitText } from "@/lib/benefit-text";
import {
  CodeReveal,
  LinkReveal,
  QrReveal,
  RevealButton,
} from "./benefit-card-parts";

interface BenefitCardProps {
  benefit: CampusBenefits;
  isRevealed: boolean;
}

const COPIED_FEEDBACK_MS = 2000;

/** Terms follow the same language rule as the rest of the card. */
function localizedTerms(benefit: CampusBenefits, locale: string) {
  return locale === "en"
    ? benefit.terms_en?.trim() || benefit.terms_nb?.trim()
    : benefit.terms_nb?.trim() || benefit.terms_en?.trim();
}

function expiryLabel(benefit: CampusBenefits, locale: string) {
  if (!benefit.publish_end) {
    return null;
  }
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "nb-NO", {
    dateStyle: "medium",
    timeZone: "Europe/Oslo",
  }).format(new Date(benefit.publish_end));
}

/** The admin editor stores HTML; older rows may hold plain text. */
function Description({ value }: { value: string }) {
  if (value.trimStart().startsWith("<")) {
    return (
      <Prose className="type-body-sm [&_p]:type-body-sm mt-4 text-ink-muted [&_p]:mb-2">
        <PlateContentRenderer value={value} />
      </Prose>
    );
  }
  // Optional, so no empty spacer when it's blank.
  return value ? (
    <p className="type-body-sm mt-4 text-ink-muted">{value}</p>
  ) : null;
}

/** The code, QR or link — behind a reveal the server records. */
function Redemption({
  benefit,
  initiallyRevealed,
}: {
  benefit: CampusBenefits;
  initiallyRevealed: boolean;
}) {
  const t = useTranslations("memberPortal.benefits");
  const [value, setValue] = useState<string | null>(
    benefit.redemption_value || null
  );
  const [copiedCode, setCopiedCode] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [revealed, setRevealed] = useState(initiallyRevealed);

  const handleReveal = async () => {
    if (revealed || isRevealing) {
      return;
    }

    setIsRevealing(true);
    try {
      const result = await revealBenefit(benefit.$id);
      if (result?.success) {
        setRevealed(true);
        if (result.value) {
          setValue(result.value);
        }
      }
    } catch (error) {
      console.error("Failed to reveal benefit:", error);
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

  if (!(revealed && value)) {
    return revealed ? null : (
      <RevealButton
        isRevealing={isRevealing}
        onReveal={handleReveal}
        revealingLabel={t("revealing")}
        revealLabel={t("reveal")}
      />
    );
  }
  if (benefit.redemption_type === "code") {
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
  if (benefit.redemption_type === "qr") {
    return <QrReveal label={t("qrLabel")} value={value} />;
  }
  if (benefit.redemption_type === "link") {
    return <LinkReveal label={t("activateBenefit")} value={value} />;
  }
  return null;
}

/**
 * One member benefit, with its code, QR or link behind a reveal.
 *
 * Title, teaser and description follow the visitor's language and fall back
 * to the other one field by field (`localizedBenefitText`); the description is
 * the admin editor's HTML and renders as such.
 */
export function BenefitCard({ benefit, isRevealed }: BenefitCardProps) {
  const t = useTranslations("memberPortal.benefits");
  const locale = useLocale();
  const text = localizedBenefitText(benefit, locale);
  const terms = localizedTerms(benefit, locale);
  const expires = expiryLabel(benefit, locale);
  const hasRedemption =
    benefit.redemption_type !== "none" && benefit.redemption_type !== "onsite";

  return (
    <div className="flex h-full flex-col rounded-biso-md border border-edge p-6">
      <div className="flex items-start gap-4">
        {benefit.partner_logo_url ? (
          <div className="relative size-14 shrink-0 overflow-hidden rounded-biso-sm border border-edge bg-surface">
            <Image
              alt={benefit.partner_name || ""}
              className="object-contain"
              fill
              sizes="56px"
              src={benefit.partner_logo_url}
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          {benefit.category ? <Pill>{benefit.category}</Pill> : null}
          <h3 className="type-heading-card mt-2 break-words text-ink">
            {text.title}
          </h3>
          {benefit.partner_name ? (
            <p className="type-body-sm mt-1 flex items-center gap-1.5 text-ink-muted">
              <Store aria-hidden="true" className="size-3.5 shrink-0" />
              {benefit.partner_name}
            </p>
          ) : null}
        </div>
      </div>

      <Description value={text.description} />

      {hasRedemption ? (
        <div className="mt-5">
          <Redemption benefit={benefit} initiallyRevealed={isRevealed} />
        </div>
      ) : null}

      {terms || expires ? (
        <div className="mt-auto flex flex-col gap-2 pt-5">
          {terms ? (
            <p className="type-body-sm rounded-biso-sm bg-surface-sunken p-3 text-ink-muted">
              <strong className="font-semibold text-ink">{t("terms")}</strong>{" "}
              {terms}
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
