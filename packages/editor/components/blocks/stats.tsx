import { cn } from "@repo/ui/lib/utils";
import { Card } from "@repo/ui/components/ui/card";
import * as Icons from "lucide-react";
import type { StatsBlockProps, GradientPreset } from "../../types";

const columnsMap = {
  "1": "grid-cols-1",
  "2": "grid-cols-1 md:grid-cols-2",
  "3": "grid-cols-1 md:grid-cols-3",
  "4": "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
};

const gradientMap: Record<GradientPreset, string> = {
  blue: "from-blue-600 to-cyan-600",
  purple: "from-purple-600 to-pink-600",
  pink: "from-pink-600 to-rose-600",
  cyan: "from-cyan-600 to-blue-600",
  green: "from-green-600 to-emerald-600",
  orange: "from-orange-600 to-red-600",
  custom: "from-[#3DA9E0] to-[#001731]",
};

export function Stats({ id, stats, columns = "3", animated = false }: StatsBlockProps) {
  return (
    <div id={id} className={cn("grid gap-6", columnsMap[columns])}>
      {stats.map((stat) => {
        const IconComponent = stat.icon && (Icons as any)[stat.icon] 
          ? (Icons as any)[stat.icon] 
          : Icons.Activity;

        return (
          <Card
            key={stat.id}
            className="p-6 text-center border-0 shadow-lg hover:shadow-xl transition-shadow bg-white"
          >
            <div
              className={cn(
                "w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center bg-linear-to-br",
                gradientMap[stat.gradient || "custom"]
              )}
            >
              <IconComponent className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {stat.number}
            </div>
            <div className="text-gray-600">{stat.label}</div>
          </Card>
        );
      })}
    </div>
  );
}

