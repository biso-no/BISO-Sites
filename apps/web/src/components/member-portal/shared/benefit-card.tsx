"use client";

import type { MemberBenefit } from "@repo/api/types/appwrite";
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

type BenefitCardProps = {
  benefit: MemberBenefit;
  isRevealed: boolean;
};

const getCategoryColor = (category: string) => {
  const colors: Record<
    string,
    { bg: string; text: string; border: string; gradient: string }
  > = {
    "Food & Drink": {
      bg: "bg-orange-100 dark:bg-orange-900/20",
      text: "text-orange-700 dark:text-orange-400",
      border: "border-orange-200 dark:border-orange-800",
      gradient: "from-orange-500 to-red-500",
    },
    Entertainment: {
      bg: "bg-purple-100 dark:bg-purple-900/20",
      text: "text-purple-700 dark:text-purple-400",
      border: "border-purple-200 dark:border-purple-800",
      gradient: "from-purple-500 to-pink-500",
    },
    "Health & Fitness": {
      bg: "bg-green-100 dark:bg-green-900/20",
      text: "text-green-700 dark:text-green-400",
      border: "border-green-200 dark:border-green-800",
      gradient: "from-green-500 to-emerald-500",
    },
    Career: {
      bg: "bg-blue-100 dark:bg-blue-900/20",
      text: "text-blue-700 dark:text-blue-400",
      border: "border-blue-200 dark:border-blue-800",
      gradient: "from-blue-500 to-cyan-500",
    },
    Software: {
      bg: "bg-pink-100 dark:bg-pink-900/20",
      text: "text-pink-700 dark:text-pink-400",
      border: "border-pink-200 dark:border-pink-800",
      gradient: "from-pink-500 to-rose-500",
    },
    Travel: {
      bg: "bg-indigo-100 dark:bg-indigo-900/20",
      text: "text-indigo-700 dark:text-indigo-400",
      border: "border-indigo-200 dark:border-indigo-800",
      gradient: "from-indigo-500 to-violet-500",
    },
    Education: {
      bg: "bg-yellow-100 dark:bg-yellow-900/20",
      text: "text-yellow-700 dark:text-yellow-400",
      border: "border-yellow-200 dark:border-yellow-800",
      gradient: "from-yellow-500 to-amber-500",
    },
  };
  return (
    colors[category] || {
      bg: "bg-muted dark:bg-inverted",
      text: "text-muted-foreground dark:text-inverted-muted",
      border: "border-border dark:border-border",
      gradient: "from-brand-gradient-from to-brand-gradient-to",
    }
  );
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
  const [value, setValue] = useState<string | null>(benefit.value || null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const Icon = getBenefitIcon(benefit.type);
  const categoryStyle = getCategoryColor(benefit.category);

  const handleReveal = async () => {
    if (revealed || isRevealing) {
      return;
    }

    setIsRevealing(true);
    try {
      const result = await revealBenefit(benefit.id);
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
          className={`absolute inset-0 bg-gradient-to-r ${categoryStyle.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-10`}
        />

        {/* Category gradient header strip */}
        <div
          className={`h-2 w-full bg-gradient-to-r ${categoryStyle.gradient}`}
        />

        <div className="p-6">
          {/* Header with logo and category */}
          <div className="mb-4 flex items-start justify-between">
            <div className="flex flex-1 items-start gap-4">
              {benefit.partnerLogo ? (
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl shadow-md">
                  <Image
                    alt={benefit.partner || ""}
                    className="object-cover"
                    fill
                    src={benefit.partnerLogo}
                  />
                </div>
              ) : (
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${categoryStyle.gradient} shadow-md`}
                >
                  <Icon className="h-7 w-7 text-white" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="mb-1 truncate font-semibold text-foreground text-lg dark:text-foreground">
                  {benefit.title}
                </h3>
                {benefit.partner && (
                  <p className="flex items-center gap-1.5 text-muted-foreground text-sm dark:text-muted-foreground">
                    <Store className="h-3.5 w-3.5" />
                    {benefit.partner}
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
            {benefit.description}
          </p>

          {/* Action area */}
          {benefit.type !== "text" && (
            <div className="relative mb-4">
              <AnimatePresence mode="wait">
                {revealed ? (
                  <motion.div
                    animate={{ opacity: 1, scale: 1 }}
                    initial={{ opacity: 0, scale: 0.95 }}
                    key="revealed-content"
                  >
                    {benefit.type === "code" && value && (
                      <CodeReveal
                        copiedCode={copiedCode}
                        copiedLabel={t("copied")}
                        copyLabel={t("copy")}
                        onCopy={handleCopyCode}
                        showConfetti={showConfetti}
                        value={value}
                      />
                    )}
                    {benefit.type === "qr" && value && (
                      <QrReveal value={value} />
                    )}
                    {benefit.type === "link" && value && (
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

          {/* Footer with terms and expiry */}
          <div className="space-y-2">
            {benefit.terms && (
              <div className="rounded-lg bg-section p-3 text-muted-foreground text-xs dark:bg-inverted dark:text-muted-foreground">
                <strong>{t("terms")}</strong> {benefit.terms}
              </div>
            )}

            {benefit.expiresAt && (
              <div className="flex items-center gap-2 text-orange-600 text-xs dark:text-orange-400">
                <Clock className="h-3.5 w-3.5" />
                {t("expires", {
                  date: new Date(benefit.expiresAt).toLocaleDateString(
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
