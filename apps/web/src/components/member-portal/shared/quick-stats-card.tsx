import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import type { LucideIcon } from "lucide-react";

type QuickStatsCardProps = {
  icon: LucideIcon;
  iconColor: string;
  value: string | number;
  label: string;
  badge?: {
    text: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
    className?: string;
  };
};

export function QuickStatsCard({
  icon: Icon,
  iconColor,
  value,
  label,
  badge,
}: QuickStatsCardProps) {
  return (
    <Card className="border-0 p-6 shadow-lg dark:bg-inverted/50 dark:backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <div
          className={`h-12 w-12 rounded-lg ${iconColor} flex items-center justify-center`}
        >
          <Icon className="h-6 w-6 text-white" />
        </div>
        {badge && (
          <Badge
            className={badge.className}
            variant={badge.variant || "default"}
          >
            {badge.text}
          </Badge>
        )}
      </div>
      <div className="mb-1 font-bold text-2xl text-foreground dark:text-foreground">
        {value}
      </div>
      <p className="text-muted-foreground text-sm dark:text-muted-foreground">
        {label}
      </p>
    </Card>
  );
}
