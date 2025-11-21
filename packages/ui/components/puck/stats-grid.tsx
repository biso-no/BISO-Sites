"use client";

import React from "react";
import { 
  Sparkles, Gift, Crown, Zap, Check, 
  Calendar, Briefcase, Rocket, Trophy,
  Megaphone, Link as LinkIcon, Users,
  Globe, BookOpen, Building, Heart,
  MapPin, CheckCircle, ArrowRight
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Card } from "../ui/card";

const IconMap = {
  Sparkles, Gift, Crown, Zap, Check,
  Calendar, Briefcase, Rocket, Trophy,
  Megaphone, Link: LinkIcon, Users,
  Globe, BookOpen, Building, Heart,
  MapPin, CheckCircle, ArrowRight
};

export type IconName = keyof typeof IconMap;

export interface StatItem {
  value: string;
  label: string;
  icon?: IconName;
  description?: string;
}

export interface StatsGridProps {
  items: StatItem[];
  columns?: 2 | 3 | 4;
  variant?: "simple" | "card" | "floating";
  align?: "center" | "left";
}

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
              <Card key={index} className="p-6 flex flex-col gap-4 hover:shadow-md transition-shadow">
                <div className={cn("flex flex-col gap-2", alignClasses[align])}>
                  {Icon && (
                    <div className="p-3 rounded-lg bg-primary/5 text-primary mb-2">
                      <Icon className="w-6 h-6" />
                    </div>
                  )}
                  <div className="text-3xl md:text-4xl font-bold text-primary">
                    {item.value}
                  </div>
                  <div className="font-medium text-muted-foreground">
                    {item.label}
                  </div>
                  {item.description && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {item.description}
                    </div>
                  )}
                </div>
              </Card>
            );
          }

          if (variant === "floating") {
             return (
               <div key={index} className={cn("relative flex flex-col p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm shadow-xl", alignClasses[align])}>
                  <div className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-linear-to-r from-primary to-primary/60 mb-2">
                    {item.value}
                  </div>
                  <div className="text-lg font-medium text-foreground/80">
                    {item.label}
                  </div>
               </div>
             )
          }

          // Simple variant
          return (
            <div key={index} className={cn("flex flex-col gap-2", alignClasses[align])}>
              {Icon && (
                <div className="mb-2 text-primary/80">
                  <Icon className="w-8 h-8" />
                </div>
              )}
              <div className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                {item.value}
              </div>
              <div className="text-base font-medium uppercase tracking-wide text-muted-foreground">
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
