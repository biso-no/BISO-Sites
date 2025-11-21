"use client";

import type { MemberBenefit } from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  QrCode,
  Store,
  Ticket,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { revealBenefit } from "@/app/actions/memberPortal";

interface BenefitCardProps {
  benefit: MemberBenefit;
  isRevealed: boolean;
}

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    "Food & Drink":
      "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800",
    Entertainment:
      "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800",
    "Health & Fitness":
      "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
    Career:
      "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
    Software:
      "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-800",
    Travel:
      "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800",
    Education:
      "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800",
  };
  return (
    colors[category] ||
    "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
  );
};

const getBenefitIcon = (type: string) => {
  switch (type) {
    case "code":
      return Copy;
    case "qr":
      return QrCode;
    case "link":
      return ExternalLink;
    default:
      return Ticket;
  }
};

export function BenefitCard({
  benefit,
  isRevealed: initialRevealed,
}: BenefitCardProps) {
  const t = useTranslations("memberPortal.benefits");
  const [revealed, setRevealed] = useState(initialRevealed);
  const [value, setValue] = useState<string | null>(benefit.value || null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);

  const Icon = getBenefitIcon(benefit.type);

  const handleReveal = async () => {
    if (revealed || isRevealing) return;

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
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <Card className="p-6 border-0 shadow-lg hover:shadow-xl transition-all dark:bg-gray-900/50 dark:backdrop-blur-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-4 flex-1">
          {benefit.partnerLogo ? (
            <img
              src={benefit.partnerLogo}
              alt={benefit.partner}
              className="w-12 h-12 rounded-lg object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-[#3DA9E0]/10 dark:bg-[#3DA9E0]/20 flex items-center justify-center shrink-0">
              <Icon className="w-6 h-6 text-[#3DA9E0]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 truncate">
              {benefit.title}
            </h3>
            {benefit.partner && (
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Store className="w-3 h-3" />
                {benefit.partner}
              </p>
            )}
          </div>
        </div>
        <Badge className={getCategoryColor(benefit.category)}>
          {benefit.category}
        </Badge>
      </div>

      <p className="text-gray-600 dark:text-gray-400 mb-4">
        {benefit.description}
      </p>

      {benefit.type !== "text" && (
        <div className="mb-4">
          {!revealed && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleReveal}
              disabled={isRevealing}
            >
              <Icon className="w-4 h-4 mr-2" />
              {isRevealing ? "Revealing..." : t("reveal")}
            </Button>
          )}

          {revealed && benefit.type === "code" && value && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <code className="text-lg font-mono text-gray-900 dark:text-gray-100">
                  {value}
                </code>
                <Button size="sm" variant="outline" onClick={handleCopyCode}>
                  {copiedCode ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      {t("copied")}
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      {t("copy")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {revealed && benefit.type === "qr" && value && (
            <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg flex justify-center">
              <div className="w-32 h-32 bg-white dark:bg-gray-900 rounded-lg border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center">
                {/* QR code would be rendered here with a library like qrcode.react */}
                <QrCode className="w-20 h-20 text-gray-400 dark:text-gray-500" />
              </div>
            </div>
          )}

          {revealed && benefit.type === "link" && value && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(value, "_blank")}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              {t("activateBenefit")}
            </Button>
          )}
        </div>
      )}

      {benefit.terms && (
        <div className="text-xs text-gray-500 dark:text-gray-400 border-t dark:border-gray-700 pt-3">
          <strong>{t("terms")}</strong> {benefit.terms}
        </div>
      )}

      {benefit.expiresAt && (
        <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400 mt-2">
          <Clock className="w-3 h-3" />
          {t("expires", {
            date: new Date(benefit.expiresAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
          })}
        </div>
      )}
    </Card>
  );
}
