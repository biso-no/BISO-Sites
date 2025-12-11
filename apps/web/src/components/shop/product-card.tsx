"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Tag, Users } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import {
  calculateSavings,
  formatPrice,
  getDisplayPrice,
} from "@/lib/types/webshop";

type ProductCardProps = {
  product: ContentTranslations;
  index: number;
  isMember?: boolean;
  onViewDetails: (product: ContentTranslations) => void;
};

const categoryColors: Record<string, string> = {
  Merch: "bg-purple-100 text-purple-700 border-purple-200",
  Trips: "bg-blue-100 text-blue-700 border-blue-200",
  Lockers: "bg-green-100 text-green-700 border-green-200",
  Membership: "bg-orange-100 text-orange-700 border-orange-200",
};

export function ProductCard({
  product,
  index,
  isMember = false,
  onViewDetails,
}: ProductCardProps) {
  const t = useTranslations("shop");
  const productData = product.product_ref;

  if (!productData) {
    return null;
  }

  const displayPrice = getDisplayPrice(
    productData.regular_price,
    productData.member_price,
    isMember
  );
  const hasDiscount =
    isMember &&
    productData.member_price &&
    productData.member_price < productData.regular_price;
  const savings = calculateSavings(
    productData.regular_price,
    productData.member_price
  );

  const shortDescription =
    product.short_description ||
    (product.description.length > 100
      ? `${product.description.substring(0, 100)}...`
      : product.description);

  const imageUrl = productData.image || "/images/logo-home.png";

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="group flex h-full flex-col overflow-hidden border-0 shadow-lg transition-all duration-300 hover:shadow-2xl">
        {/* Image */}
        <div className="relative h-64 overflow-hidden">
          <ImageWithFallback
            alt={product.title}
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            src={imageUrl}
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />

          <div className="absolute top-4 left-4 flex flex-col gap-2">
            <Badge
              className={`${categoryColors[productData.category] || categoryColors.Merch}`}
            >
              {productData.category}
            </Badge>
            {productData.member_only && (
              <Badge className="flex items-center gap-1 border-0 bg-orange-500 text-white">
                <Users className="h-3 w-3" />
                {t("card.membersOnly")}
              </Badge>
            )}
            {hasDiscount && savings > 0 && (
              <Badge className="flex items-center gap-1 border-0 bg-green-500 text-white">
                <Tag className="h-3 w-3" />
                {t("card.save", { amount: savings })}
              </Badge>
            )}
          </div>

          {productData.stock !== null &&
            productData.stock <= 10 &&
            productData.stock > 0 && (
              <div className="absolute right-4 bottom-4 rounded-full bg-red-500/90 px-3 py-1 backdrop-blur-sm">
                <span className="font-medium text-sm text-white">
                  {t("card.onlyLeft", { count: productData.stock })}
                </span>
              </div>
            )}

          {productData.stock === 0 && (
            <div className="absolute right-4 bottom-4 rounded-full bg-inverted/90 px-3 py-1 backdrop-blur-sm">
              <span className="font-medium text-sm text-white">
                {t("card.outOfStock")}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex grow flex-col p-6">
          <h3 className="mb-3 font-semibold text-foreground text-xl">
            {product.title}
          </h3>
          <p className="mb-4 line-clamp-2 grow text-muted-foreground text-sm">
            {shortDescription}
          </p>

          {/* Price */}
          <div className="mb-6">
            {hasDiscount ? (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-lg line-through">
                  {formatPrice(productData.regular_price)}
                </span>
                <span className="font-bold text-brand text-xl">
                  {formatPrice(displayPrice)}
                </span>
              </div>
            ) : (
              <div className="font-bold text-foreground text-xl">
                {formatPrice(displayPrice)}
              </div>
            )}

            {!isMember &&
              productData.member_price &&
              productData.member_price < productData.regular_price && (
                <p className="mt-1 text-muted-foreground text-sm">
                  {t("card.membersPay", { price: formatPrice(productData.member_price) })}
                </p>
              )}
          </div>

          <Button
            className="w-full border-0 bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={productData.stock === 0}
            onClick={() => onViewDetails(product)}
          >
            {productData.stock === 0 ? t("card.outOfStock") : t("card.viewDetails")}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
