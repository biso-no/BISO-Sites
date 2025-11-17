import { cn } from "@repo/ui/lib/utils";
import { Card } from "@repo/ui/components/ui/card";
import * as Icons from "lucide-react";
import type { FeaturesBlockProps } from "../../types";

const columnsMap = {
  "1": "grid-cols-1",
  "2": "grid-cols-1 md:grid-cols-2",
  "3": "grid-cols-1 md:grid-cols-3",
  "4": "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
};

const cardVariantMap = {
  default: "bg-white border shadow-lg",
  glass: "glass border-0",
  gradient: "bg-linear-to-br from-[#3DA9E0] to-[#001731] border-0 text-white",
};

export function Features({
  id,
  features,
  columns = "3",
  iconPosition = "top",
  cardVariant = "default",
}: FeaturesBlockProps) {
  const isGradient = cardVariant === "gradient";

  return (
    <div id={id} className={cn("grid gap-8", columnsMap[columns])}>
      {features.map((feature) => {
        const IconComponent = feature.icon && (Icons as any)[feature.icon]
          ? (Icons as any)[feature.icon]
          : Icons.Box;

        return (
          <Card
            key={feature.id}
            className={cn(
              "p-8 hover:shadow-xl transition-all hover:-translate-y-1 duration-300",
              cardVariantMap[cardVariant],
              iconPosition === "left" && "flex gap-6"
            )}
          >
            <div
              className={cn(
                "rounded-2xl flex items-center justify-center shrink-0",
                iconPosition === "top" ? "w-16 h-16 mb-6" : "w-12 h-12",
                isGradient
                  ? "bg-white/20"
                  : "bg-linear-to-br from-[#3DA9E0] to-[#001731] shadow-lg"
              )}
            >
              <IconComponent
                className={cn("w-8 h-8", isGradient ? "text-white" : "text-white")}
              />
            </div>
            <div>
              <h3
                className={cn(
                  "text-xl font-bold mb-3",
                  isGradient ? "text-white" : "text-gray-900"
                )}
              >
                {feature.title}
              </h3>
              <p className={cn(isGradient ? "text-white/90" : "text-gray-600")}>
                {feature.description}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

