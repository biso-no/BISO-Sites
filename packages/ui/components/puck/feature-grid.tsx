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
import Link from "next/link";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

// Map of available icons
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

export type FeatureItem = {
  title: string;
  description: string;
  icon?: IconName;
  image?: string;
  href?: string;
  badge?: string;
};

export type FeatureGridProps = {
  title?: string;
  subtitle?: string;
  items: FeatureItem[];
  columns?: 2 | 3 | 4;
  variant?: "card" | "icon" | "simple" | "checklist" | "project" | "process";
  align?: "center" | "left";
};

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
            <h2 className="mb-4 font-bold text-3xl text-foreground tracking-tight sm:text-4xl">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-lg text-muted-foreground">{subtitle}</p>
          )}
        </div>
      )}

      <div className={cn("grid gap-8", gridCols[columns])}>
        {items.map((item, index) => {
          const Icon = item.icon ? IconMap[item.icon] : null;

          if (variant === "card") {
            return (
              <Card
                className="flex h-full flex-col p-6 transition-all hover:shadow-lg"
                key={index}
              >
                <div
                  className={cn(
                    "flex h-full flex-col gap-4",
                    align === "center"
                      ? "items-center text-center"
                      : "items-start text-left"
                  )}
                >
                  {Icon && (
                    <div className="rounded-lg bg-primary/10 p-3 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <h3 className="font-semibold text-xl">{item.title}</h3>
                    <p className="text-muted-foreground">{item.description}</p>
                  </div>
                  {item.href && (
                    <Link
                      className="mt-4 font-medium text-primary text-sm hover:underline"
                      href={item.href}
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
              <Card
                className="group flex h-full flex-col overflow-hidden border-primary/10 bg-white transition-all hover:shadow-lg"
                key={index}
              >
                {/* Gradient Bar */}
                <div className="h-2 w-full bg-linear-to-r from-[#3DA9E0] to-[#001731]" />

                <div className="flex h-full flex-col p-6">
                  {item.badge && (
                    <Badge
                      className="mb-4 w-fit border-primary/10 bg-primary/5 text-primary"
                      variant="secondary"
                    >
                      {item.badge}
                    </Badge>
                  )}

                  <h3 className="mb-2 font-bold text-xl transition-colors group-hover:text-primary">
                    {item.title}
                  </h3>

                  <p className="mb-6 flex-1 text-muted-foreground">
                    {item.description}
                  </p>

                  {item.href && (
                    <Button
                      asChild
                      className="group/btn w-full"
                      variant="outline"
                    >
                      <Link href={item.href}>
                        View Project{" "}
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                      </Link>
                    </Button>
                  )}
                </div>
              </Card>
            );
          }

          if (variant === "checklist") {
            const CheckIcon = Icon || CheckCircle;
            return (
              <div
                className="flex items-start gap-3 rounded-xl border border-border bg-white p-4 transition-all hover:border-primary/30 hover:shadow-sm"
                key={index}
              >
                <div className="mt-0.5 shrink-0 text-green-500">
                  <CheckIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  {item.description && (
                    <p className="mt-1 text-muted-foreground text-sm">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            );
          }

          if (variant === "process") {
            return (
              <div
                className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-white p-6 transition-all hover:shadow-md"
                key={index}
              >
                <div className="-mt-4 -mr-4 absolute top-0 right-0 select-none p-4 font-bold text-9xl leading-none opacity-10">
                  {index + 1}
                </div>
                <div className="relative z-10">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-xl">
                    {index + 1}
                  </div>
                  <h3 className="mb-2 font-bold text-xl">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </div>
            );
          }

          if (variant === "icon") {
            return (
              <div
                className={cn(
                  "flex flex-col gap-4",
                  align === "center"
                    ? "items-center text-center"
                    : "items-start text-left"
                )}
                key={index}
              >
                {Icon && (
                  <div className="mb-2 rounded-full bg-primary/5 p-4 text-primary">
                    <Icon className="h-8 w-8" />
                  </div>
                )}
                <h3 className="font-semibold text-xl">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
                {item.href && (
                  <Link
                    className="font-medium text-primary hover:underline"
                    href={item.href}
                  >
                    Learn more
                  </Link>
                )}
              </div>
            );
          }

          // Simple variant (good for lists/checks)
          return (
            <div className="flex gap-4" key={index}>
              {Icon && (
                <div className="mt-1 shrink-0 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
              )}
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-muted-foreground text-sm">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
