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
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import Link from "next/link";

// Map of available icons
const IconMap = {
  Sparkles, Gift, Crown, Zap, Check,
  Calendar, Briefcase, Rocket, Trophy,
  Megaphone, Link: LinkIcon, Users,
  Globe, BookOpen, Building, Heart,
  MapPin, CheckCircle, ArrowRight
};

export type IconName = keyof typeof IconMap;

export interface FeatureItem {
  title: string;
  description: string;
  icon?: IconName;
  image?: string;
  href?: string;
  badge?: string;
}

export interface FeatureGridProps {
  title?: string;
  subtitle?: string;
  items: FeatureItem[];
  columns?: 2 | 3 | 4;
  variant?: "card" | "icon" | "simple" | "checklist" | "project" | "process";
  align?: "center" | "left";
}

export function FeatureGrid({
  title,
  subtitle,
  items = [],
  columns = 3,
  variant = "card",
  align = "center",
}: FeatureGridProps) {
  const gridCols = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
  };

  const alignClasses = {
    center: "text-center mx-auto",
    left: "text-left",
  };

  return (
    <div className="w-full py-12">
      {(title || subtitle) && (
        <div className={cn("mb-12 max-w-3xl", alignClasses[align])}>
          {title && (
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-lg text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      )}

      <div className={cn("grid gap-8", gridCols[columns])}>
        {items.map((item, index) => {
          const Icon = item.icon ? IconMap[item.icon] : null;
          
          if (variant === "card") {
            return (
              <Card key={index} className="p-6 h-full flex flex-col transition-all hover:shadow-lg">
                <div className={cn("flex flex-col gap-4 h-full", align === "center" ? "items-center text-center" : "items-start text-left")}>
                  {Icon && (
                    <div className="p-3 rounded-lg bg-primary/10 text-primary">
                      <Icon className="w-6 h-6" />
                    </div>
                  )}
                  <div className="space-y-2 flex-1">
                    <h3 className="font-semibold text-xl">{item.title}</h3>
                    <p className="text-muted-foreground">{item.description}</p>
                  </div>
                  {item.href && (
                    <Link 
                      href={item.href}
                      className="text-sm font-medium text-primary hover:underline mt-4"
                    >
                      Learn more →
                    </Link>
                  )}
                </div>
              </Card>
            );
          }

          if (variant === "project") {
             return (
               <Card key={index} className="h-full flex flex-col overflow-hidden transition-all hover:shadow-lg group border-primary/10 bg-white">
                 {/* Gradient Bar */}
                 <div className="h-2 w-full bg-linear-to-r from-[#3DA9E0] to-[#001731]" />
                 
                 <div className="p-6 flex flex-col h-full">
                   {item.badge && (
                     <Badge variant="secondary" className="w-fit mb-4 bg-primary/5 text-primary border-primary/10">
                       {item.badge}
                     </Badge>
                   )}
                   
                   <h3 className="font-bold text-xl mb-2 group-hover:text-primary transition-colors">
                     {item.title}
                   </h3>
                   
                   <p className="text-muted-foreground mb-6 flex-1">
                     {item.description}
                   </p>
                   
                   {item.href && (
                     <Button asChild variant="outline" className="w-full group/btn">
                       <Link href={item.href}>
                         View Project <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                       </Link>
                     </Button>
                   )}
                 </div>
               </Card>
             )
          }

          if (variant === "checklist") {
             const CheckIcon = Icon || CheckCircle;
             return (
               <div key={index} className="flex items-start gap-3 p-4 rounded-xl bg-white border border-border hover:border-primary/30 hover:shadow-sm transition-all">
                 <div className="shrink-0 mt-0.5 text-green-500">
                   <CheckIcon className="w-5 h-5" />
                 </div>
                 <div>
                   <h3 className="font-semibold text-gray-900">{item.title}</h3>
                   {item.description && (
                     <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                   )}
                 </div>
               </div>
             )
          }

          if (variant === "process") {
             return (
               <div key={index} className="flex flex-col gap-4 p-6 rounded-2xl bg-white border border-border hover:shadow-md transition-all relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl font-bold leading-none -mt-4 -mr-4 select-none">
                   {index + 1}
                 </div>
                 <div className="relative z-10">
                   <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl mb-4">
                     {index + 1}
                   </div>
                   <h3 className="font-bold text-xl mb-2">{item.title}</h3>
                   <p className="text-muted-foreground">{item.description}</p>
                 </div>
               </div>
             )
          }

          if (variant === "icon") {
            return (
              <div key={index} className={cn("flex flex-col gap-4", align === "center" ? "items-center text-center" : "items-start text-left")}>
                {Icon && (
                  <div className="p-4 rounded-full bg-primary/5 text-primary mb-2">
                    <Icon className="w-8 h-8" />
                  </div>
                )}
                <h3 className="font-semibold text-xl">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
                {item.href && (
                  <Link href={item.href} className="text-primary hover:underline font-medium">
                    Learn more
                  </Link>
                )}
              </div>
            );
          }

          // Simple variant (good for lists/checks)
          return (
            <div key={index} className="flex gap-4">
              {Icon && (
                <div className="shrink-0 mt-1 text-primary">
                  <Icon className="w-5 h-5" />
                </div>
              )}
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
