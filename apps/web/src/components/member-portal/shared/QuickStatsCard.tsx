import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface QuickStatsCardProps {
  icon: LucideIcon;
  iconColor: string;
  value: string | number;
  label: string;
  badge?: {
    text: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
    className?: string;
  };
}

export function QuickStatsCard({
  icon: Icon,
  iconColor,
  value,
  label,
  badge,
}: QuickStatsCardProps) {
  return (
    <Card className="p-6 border-0 shadow-lg dark:bg-gray-900/50 dark:backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div
          className={`w-12 h-12 rounded-lg ${iconColor} flex items-center justify-center`}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>
        {badge && (
          <Badge
            variant={badge.variant || "default"}
            className={badge.className}
          >
            {badge.text}
          </Badge>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        {value}
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
    </Card>
  );
}
