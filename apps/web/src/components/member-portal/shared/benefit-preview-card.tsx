"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import {
  Coffee,
  Film,
  Briefcase,
  Dumbbell,
  Laptop,
  Plane,
  GraduationCap,
  Lock,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

type BenefitPreviewCardProps = {
  category: string;
  partnerName: string;
  partnerLogo?: string | null;
  discountText: string;
  index?: number;
  onJoinClick?: () => void;
};

const getCategoryIcon = (category: string) => {
  const icons: Record<string, typeof Coffee> = {
    "Food & Drink": Coffee,
    Entertainment: Film,
    Career: Briefcase,
    "Health & Fitness": Dumbbell,
    Software: Laptop,
    Travel: Plane,
    Education: GraduationCap,
  };
  return icons[category] || Sparkles;
};

const getCategoryGradient = (category: string) => {
  const gradients: Record<string, string> = {
    "Food & Drink": "from-orange-500 to-red-500",
    Entertainment: "from-purple-500 to-pink-500",
    Career: "from-blue-500 to-cyan-500",
    "Health & Fitness": "from-green-500 to-emerald-500",
    Software: "from-pink-500 to-rose-500",
    Travel: "from-indigo-500 to-violet-500",
    Education: "from-yellow-500 to-amber-500",
  };
  return gradients[category] || "from-brand-gradient-from to-brand-gradient-to";
};

export function BenefitPreviewCard({
  category,
  partnerName,
  discountText,
  index = 0,
  onJoinClick,
}: BenefitPreviewCardProps) {
  const t = useTranslations("memberPortal");
  const Icon = getCategoryIcon(category);
  const gradient = getCategoryGradient(category);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="group relative"
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="relative overflow-hidden border-0 bg-background p-0 shadow-lg transition-all duration-300 hover:shadow-2xl dark:bg-inverted/50">
        {/* Animated gradient border effect */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-brand/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        {/* Category gradient header */}
        <div
          className={`bg-gradient-to-r ${gradient} relative h-24 overflow-hidden p-4`}
        >
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/20" />
            <div className="absolute -bottom-2 -left-2 h-16 w-16 rounded-full bg-white/10" />
          </div>

          {/* Category icon */}
          <div className="relative flex h-full items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <Icon className="h-6 w-6 text-white" />
            </div>
          </div>

          {/* Lock overlay */}
          <div className="absolute right-2 top-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <Lock className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Category badge */}
          <Badge
            className={`mb-3 bg-gradient-to-r ${gradient} border-0 text-white`}
          >
            {category}
          </Badge>

          {/* Partner name (partial blur effect) */}
          <h3 className="mb-1 font-semibold text-foreground text-lg dark:text-foreground">
            {partnerName}
          </h3>

          {/* Discount text */}
          <div className="mb-4">
            <span className="font-bold text-xl text-brand">{discountText}</span>
          </div>

          {/* Teaser text */}
          <p className="mb-4 text-muted-foreground text-sm dark:text-muted-foreground">
            {t("preview.unlockDescription")}
          </p>

          {/* CTA Button */}
          <Button
            className="w-full bg-gradient-to-r from-brand-gradient-from to-brand-gradient-to text-white hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90"
            onClick={onJoinClick}
            size="sm"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {t("preview.unlockBenefit")}
          </Button>
        </div>

        {/* Hover glow effect */}
        <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 shadow-[inset_0_0_40px_rgba(61,169,224,0.1)] transition-opacity duration-300 group-hover:opacity-100" />
      </Card>
    </motion.div>
  );
}
