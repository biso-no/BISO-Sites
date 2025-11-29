"use client";

import {
  Star,
  Users,
  Heart,
  Target,
  Shield,
  Briefcase,
  GraduationCap,
  Calendar,
  MapPin,
  CheckCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../../../lib/utils";
import type { CollectionItem, LayoutRendererProps } from "../types";

const GRID_COLS: Record<number, string> = {
  2: "md:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "md:grid-cols-2 lg:grid-cols-4",
};

const ICON_MAP: Record<string, LucideIcon> = {
  star: Star,
  users: Users,
  heart: Heart,
  target: Target,
  shield: Shield,
  briefcase: Briefcase,
  graduationcap: GraduationCap,
  calendar: Calendar,
  mappin: MapPin,
  checkcircle: CheckCircle,
};

function getIcon(name?: string): LucideIcon {
  if (!name) {
    return Star;
  }
  const key = name.toLowerCase().replace(/[-_\s]/g, "");
  return ICON_MAP[key] || Star;
}

function FeatureItem({ item }: { item: CollectionItem }) {
  const Icon = getIcon(item.icon);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/10 bg-primary/5 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold text-foreground text-lg">{item.title}</h3>
        {item.subtitle && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {item.subtitle}
          </p>
        )}
        {item.description && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {item.description}
          </p>
        )}
      </div>
    </div>
  );
}

export function IconFeatureLayout({
  items,
  columns = 3,
}: LayoutRendererProps) {
  const gridClass = GRID_COLS[columns] || GRID_COLS[3];

  return (
    <div className={cn("grid gap-8", gridClass)}>
      {items.map((item) => (
        <FeatureItem item={item} key={item.id} />
      ))}
    </div>
  );
}
