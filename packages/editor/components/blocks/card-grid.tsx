import { cn } from "@repo/ui/lib/utils";
import { Card } from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { ArrowRight } from "lucide-react";
import { getStorageFileUrl } from "@repo/api/storage";
import type { CardGridBlockProps } from "../../types";

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
  golden: "bg-linear-to-br from-gold-subtle to-gold-muted border-gold-default/20 text-primary-100",
};

export function CardGrid({
  id,
  cards,
  columns = "3",
  cardVariant = "default",
}: CardGridBlockProps) {
  const isLight = cardVariant === "default" || cardVariant === "glass";

  return (
    <div id={id} className={cn("grid gap-8", columnsMap[columns])}>
      {cards.map((card) => {
        const imageUrl = card.image?.type === "upload" && card.image.fileId
          ? getStorageFileUrl("content", card.image.fileId)
          : card.image?.url;

        return (
          <Card
            key={card.id}
            className={cn(
              "overflow-hidden hover:shadow-2xl transition-all duration-300 group h-full flex flex-col",
              cardVariantMap[cardVariant]
            )}
          >
            {imageUrl && (
              <div className="relative h-56 overflow-hidden">
                <img
                  src={imageUrl}
                  alt={card.image?.alt || card.title}
                  className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
            )}

            <div className="p-6 flex flex-col grow">
              <h3
                className={cn(
                  "text-xl font-bold mb-3",
                  isLight ? "text-gray-900" : "text-white"
                )}
              >
                {card.title}
              </h3>
              <p className={cn("mb-4 grow", isLight ? "text-gray-600" : "text-white/90")}>
                {card.description}
              </p>

              {card.link && (
                <Button
                  asChild
                  variant="ghost"
                  className={cn(
                    "p-0 h-auto group self-start",
                    isLight ? "text-[#001731] hover:text-[#3DA9E0]" : "text-white hover:text-white/80"
                  )}
                >
                  <a href={card.link}>
                    {card.linkLabel || "Learn More"}
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </a>
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

