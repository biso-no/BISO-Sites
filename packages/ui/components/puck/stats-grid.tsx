"use client";

import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Building,
  Calendar,
  Check,
  CheckCircle,
  Crown,
  Gift,
  Globe,
  Heart,
  Link as LinkIcon,
  MapPin,
  Megaphone,
  Rocket,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Card } from "../ui/card";

const IconMap = {
  Sparkles,
  Gift,
  Crown,
  Zap,
  Check,
  Calendar,
  Briefcase,
  Rocket,
  Trophy,
  Megaphone,
  Link: LinkIcon,
  Users,
  Globe,
  BookOpen,
  Building,
  Heart,
  MapPin,
  CheckCircle,
  ArrowRight,
};

export type IconName = keyof typeof IconMap;

export type StatItem = {
  value: string;
  label: string;
  icon?: IconName;
  description?: string;
};

export type StatsGridProps = {
  items: StatItem[];
  columns?: 2 | 3 | 4;
  variant?: "simple" | "card" | "floating";
  align?: "center" | "left";
};

export function StatsGrid({
  items = [],
  columns = 4,
  variant = "simple",
  align = "center",
}: StatsGridProps) {
  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
  };

  const alignClasses = {
    center: "text-center items-center",
    left: "text-left items-start",
  };

  return (
    <div className="w-full py-8">
      <div className={cn("grid gap-8", gridCols[columns])}>
        {items.map((item, index) => {
          const Icon = item.icon ? IconMap[item.icon] : null;

          if (variant === "card") {
            return (
              <Card
                className="flex flex-col gap-4 p-6 transition-shadow hover:shadow-md"
                key={index}
              >
                <div className={cn("flex flex-col gap-2", alignClasses[align])}>
                  {Icon && (
                    <div className="mb-2 rounded-lg bg-primary/5 p-3 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                  )}
                  <div className="font-bold text-3xl text-primary md:text-4xl">
                    {item.value}
                  </div>
                  <div className="font-medium text-muted-foreground">
                    {item.label}
                  </div>
                  {item.description && (
                    <div className="mt-1 text-muted-foreground text-sm">
                      {item.description}
                    </div>
                  )}
                </div>
              </Card>
            );
          }

          if (variant === "floating") {
            return (
              <div
                className={cn(
                  "relative flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-sm",
                  alignClasses[align]
                )}
                key={index}
              >
                <div className="mb-2 bg-linear-to-r from-primary to-primary/60 bg-clip-text font-bold text-4xl text-transparent md:text-5xl">
                  {item.value}
                </div>
                <div className="font-medium text-foreground/80 text-lg">
                  {item.label}
                </div>
              </div>
            );
          }

          // Simple variant
          return (
            <div
              className={cn("flex flex-col gap-2", alignClasses[align])}
              key={index}
            >
              {Icon && (
                <div className="mb-2 text-primary/80">
                  <Icon className="h-8 w-8" />
                </div>
              )}
              <div className="font-bold text-4xl text-foreground tracking-tight md:text-5xl">
                {item.value}
              </div>
              <div className="font-medium text-base text-muted-foreground uppercase tracking-wide">
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
