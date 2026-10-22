"use client";

import type { PublicBenefit } from "@repo/shared/utils/benefit-public";
import { PlateContentRenderer } from "@repo/ui/components/plate-content-renderer";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import { Clock, Copy, ExternalLink, IdCard, Store, Ticket } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { revealBenefit } from "@/app/actions/member-portal";
import {
  benefitCategoryLabel,
  localizedPublicBenefitText,
} from "@/lib/benefit-text";
import { CodeReveal, LinkReveal, RevealButton } from "./benefit-card-parts";

interface BenefitCardProps {
  benefit: PublicBenefit;
  /**
   * Whether the member has revealed this benefit before. The value itself is
   * never sent to the browser with the page, so a previously revealed benefit
   * still fetches it (idempotently) through `revealBenefit`.
   */
  isRevealed: boolean;
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

const DATE_LOCALES: Record<string, string> = { en: "en-GB", no: "nb-NO" };

/** Stored HTML or Plate JSON starts with "<" or "["; anything else is text. */
const isRichDescription = (description: string) => {
  const start = description.trimStart().charAt(0);
  return start === "<" || start === "[";
};

const getCategoryColor = (_category: string) => {
  // Use BI brand colors for all categories for a unified premium look
  return {
    bg: "bg-brand-muted",
    text: "text-brand",
    border: "border-brand-border",
    gradient: "from-brand-gradient-from to-brand-gradient-to",
  };
};

const BENEFIT_ICONS: Record<string, typeof Copy> = {
  code: Copy,
  link: ExternalLink,
  onsite: IdCard,
};

const getBenefitIcon = (type: string) => BENEFIT_ICONS[type] || Ticket;

export function BenefitCard({ benefit }: BenefitCardProps) {
  const t = useTranslations("memberPortal.benefits");
  const locale = useLocale();
  const text = localizedPublicBenefitText(benefit, locale);
  const categoryLabel = benefitCategoryLabel(benefit.category, locale);
  const [value, setValue] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const Icon = getBenefitIcon(benefit.redemptionType);
  const categoryStyle = getCategoryColor(benefit.category ?? "");

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
      setShowConfetti(true);
      setTimeout(() => setCopiedCode(false), 2000);
      setTimeout(() => setShowConfetti(false), 1000);
    }
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="group relative"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -4 }}
    >
      <Card className="relative overflow-hidden border-0 p-0 shadow-lg transition-all duration-300 hover:shadow-2xl dark:bg-inverted/50 dark:backdrop-blur-sm">
        {/* Animated gradient border on hover */}
        <div
          className={`absolute inset-0 bg-linear-to-r ${categoryStyle.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-10`}
        />

        {/* Category gradient header strip */}
        <div
          className={`h-2 w-full bg-linear-to-r ${categoryStyle.gradient}`}
        />

        <div className="p-6">
          {/* Header with logo and category */}
          <div className="mb-4 flex items-start justify-between">
            <div className="flex flex-1 items-start gap-4">
              {benefit.partner?.logoUrl ? (
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl shadow-md">
                  <Image
                    alt={benefit.partner.name}
                    className="object-cover"
                    fill
                    sizes="56px"
                    src={benefit.partner.logoUrl}
                    unoptimized
                  />
                </div>
              ) : (
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${categoryStyle.gradient} shadow-md`}
                >
                  <Icon className="h-7 w-7 text-white" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="mb-1 truncate font-semibold text-foreground text-lg dark:text-foreground">
                  {text.title}
                </h3>
                {benefit.partner && (
                  <p className="flex items-center gap-1.5 text-muted-foreground text-sm dark:text-muted-foreground">
                    <Store className="h-3.5 w-3.5" />
                    {benefit.partner.name}
                  </p>
                )}
              </div>
            </div>
            {categoryLabel && (
              <Badge
                className={`${categoryStyle.bg} ${categoryStyle.text} ${categoryStyle.border}`}
              >
                {categoryLabel}
              </Badge>
            )}
          </div>

          {benefit.imageUrl ? (
            <div className="relative mb-4 h-36 w-full overflow-hidden rounded-xl">
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

          {/* Description — optional, so no empty spacer when it's blank.
              Older benefits still hold HTML or Plate JSON; newer ones are
              plain text with line breaks. */}
          {isRichDescription(text.description) ? (
            <PlateContentRenderer
              className="prose-sm mb-5 text-muted-foreground"
              value={text.description}
            />
          ) : (
            text.description && (
              <p className="mb-5 whitespace-pre-line text-muted-foreground dark:text-muted-foreground">
                {text.description}
              </p>
            )
          )}

          {/* Action area: only code and link benefits have something to reveal */}
          {benefit.redemptionType === "onsite" && (
            <p className="mb-4 flex items-center gap-2 rounded-xl bg-brand-muted p-3 text-brand text-sm">
              <IdCard className="h-4 w-4 shrink-0" />
              {t("onsite")}
            </p>
          )}
          {(benefit.redemptionType === "code" ||
            benefit.redemptionType === "link") && (
            <div className="relative mb-4">
              <AnimatePresence mode="wait">
                {value === null ? (
                  <RevealButton
                    gradient={categoryStyle.gradient}
                    isRevealing={isRevealing}
                    key="reveal-button"
                    onReveal={handleReveal}
                    revealingLabel={t("revealing")}
                    revealLabel={t("reveal")}
                  />
                ) : (
                  <motion.div
                    animate={{ opacity: 1, scale: 1 }}
                    initial={{ opacity: 0, scale: 0.95 }}
                    key="revealed-content"
                  >
                    {benefit.redemptionType === "code" && (
                      <CodeReveal
                        copiedCode={copiedCode}
                        copiedLabel={t("copied")}
                        copyLabel={t("copy")}
                        onCopy={handleCopyCode}
                        showConfetti={showConfetti}
                        value={value}
                      />
                    )}
                    {benefit.redemptionType === "link" && (
                      <LinkReveal
                        gradient={categoryStyle.gradient}
                        label={t("activateBenefit")}
                        value={value}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              {errorKey ? (
                <p className="mt-2 text-red-600 text-sm dark:text-red-400">
                  {t(errorKey)}
                </p>
              ) : null}
            </div>
          )}

          {/* Footer: terms + expiry */}
          <div className="space-y-2">
            {text.terms && (
              <div className="rounded-lg bg-section p-3 text-muted-foreground text-xs dark:bg-inverted dark:text-muted-foreground">
                <strong>{t("terms")}</strong> {text.terms}
              </div>
            )}

            {benefit.publishEnd && (
              <div className="flex items-center gap-2 text-orange-600 text-xs dark:text-orange-400">
                <Clock className="h-3.5 w-3.5" />
                {t("expires", {
                  date: new Date(benefit.publishEnd).toLocaleDateString(
                    DATE_LOCALES[locale] ?? DATE_LOCALES.en,
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }
                  ),
                })}
              </div>
            )}
          </div>
        </div>

        {/* Hover glow effect */}
        <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 shadow-[inset_0_0_40px_rgba(61,169,224,0.1)] transition-opacity duration-300 group-hover:opacity-100" />
      </Card>
    </motion.div>
  );
}
