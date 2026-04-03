"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import {
  Briefcase,
  Coffee,
  Dumbbell,
  Film,
  GraduationCap,
  Laptop,
  Lock,
  Plane,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";

type BenefitPreviewCardProps = {
  category: string;
  partnerName: string;
  partnerLogo?: string | null;
  discountText: string;
  index?: number;
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
  return "from-brand-gradient-from to-brand-gradient-to";
};

export function BenefitPreviewCard({
  category,
  partnerName,
  discountText,
  index = 0,
}: BenefitPreviewCardProps) {
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
            <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-white/20" />
            <div className="absolute -bottom-2 -left-2 h-16 w-16 rounded-full bg-white/10" />
          </div>

          {/* Category icon */}
          <div className="relative flex h-full items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <Icon className="h-6 w-6 text-white" />
            </div>
          </div>

          {/* Lock overlay */}
          <div className="absolute top-2 right-2">
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
          <div>
            <span className="font-bold text-brand text-xl">{discountText}</span>
          </div>
        </div>

        {/* Hover glow effect */}
        <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 shadow-[inset_0_0_40px_rgba(61,169,224,0.1)] transition-opacity duration-300 group-hover:opacity-100" />
      </Card>
    </motion.div>
  );
}
