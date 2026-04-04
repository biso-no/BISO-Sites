"use client";

import type { CampusBenefit } from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import { Clock, Copy, ExternalLink, QrCode, Store, Ticket } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { revealBenefit } from "@/app/actions/member-portal";
import {
  CodeReveal,
  LinkReveal,
  QrReveal,
  RevealButton,
} from "./benefit-card-parts";

interface BenefitCardProps {
  benefit: CampusBenefit;
  isRevealed: boolean;
}

const getCategoryColor = (category: string) => {
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
  qr: QrCode,
  link: ExternalLink,
};

const getBenefitIcon = (type: string) => BENEFIT_ICONS[type] || Ticket;

export function BenefitCard({
  benefit,
  isRevealed: initialRevealed,
}: BenefitCardProps) {
  const t = useTranslations("memberPortal.benefits");
  const [revealed, setRevealed] = useState(initialRevealed);
  const [value, setValue] = useState<string | null>(
    benefit.redemption_value || null
  );
  const [copiedCode, setCopiedCode] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const Icon = getBenefitIcon(benefit.redemption_type);
  const categoryStyle = getCategoryColor(benefit.category);

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
              {benefit.partner_logo_url ? (
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl shadow-md">
                  <Image
                    alt={benefit.partner_name || ""}
                    className="object-cover"
                    fill
                    src={benefit.partner_logo_url}
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
                  {benefit.title_en}
                </h3>
                {benefit.partner_name && (
                  <p className="flex items-center gap-1.5 text-muted-foreground text-sm dark:text-muted-foreground">
                    <Store className="h-3.5 w-3.5" />
                    {benefit.partner_name}
                  </p>
                )}
              </div>
            </div>
            <Badge
              className={`${categoryStyle.bg} ${categoryStyle.text} ${categoryStyle.border}`}
            >
              {benefit.category}
            </Badge>
          </div>

          {/* Description */}
          <p className="mb-5 text-muted-foreground dark:text-muted-foreground">
            {benefit.description_en}
          </p>

          {/* Action area — only if there's something to reveal */}
          {benefit.redemption_type !== "none" &&
            benefit.redemption_type !== "onsite" && (
              <div className="relative mb-4">
                <AnimatePresence mode="wait">
                  {revealed ? (
                    <motion.div
                      animate={{ opacity: 1, scale: 1 }}
                      initial={{ opacity: 0, scale: 0.95 }}
                      key="revealed-content"
                    >
                      {benefit.redemption_type === "code" && value && (
                        <CodeReveal
                          copiedCode={copiedCode}
                          copiedLabel={t("copied")}
                          copyLabel={t("copy")}
                          onCopy={handleCopyCode}
                          showConfetti={showConfetti}
                          value={value}
                        />
                      )}
                      {benefit.redemption_type === "qr" && value && (
                        <QrReveal value={value} />
                      )}
                      {benefit.redemption_type === "link" && value && (
                        <LinkReveal
                          gradient={categoryStyle.gradient}
                          label={t("activateBenefit")}
                          value={value}
                        />
                      )}
                    </motion.div>
                  ) : (
                    <RevealButton
                      gradient={categoryStyle.gradient}
                      isRevealing={isRevealing}
                      onReveal={handleReveal}
                      revealingLabel={t("revealing")}
                      revealLabel={t("reveal")}
                    />
                  )}
                </AnimatePresence>
              </div>
            )}

          {/* Footer: terms + expiry */}
          <div className="space-y-2">
            {benefit.terms_en && (
              <div className="rounded-lg bg-section p-3 text-muted-foreground text-xs dark:bg-inverted dark:text-muted-foreground">
                <strong>{t("terms")}</strong> {benefit.terms_en}
              </div>
            )}

            {benefit.publish_end && (
              <div className="flex items-center gap-2 text-orange-600 text-xs dark:text-orange-400">
                <Clock className="h-3.5 w-3.5" />
                {t("expires", {
                  date: new Date(benefit.publish_end).toLocaleDateString(
                    "en-US",
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
