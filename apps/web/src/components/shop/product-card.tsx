"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Tag, Users } from "lucide-react";
import { motion } from "motion/react";
import {
  calculateSavings,
  formatPrice,
  getDisplayPrice,
} from "@/lib/types/webshop";

interface ProductCardProps {
  product: ContentTranslations;
  index: number;
  isMember?: boolean;
  onViewDetails: (product: ContentTranslations) => void;
}

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
  const productData = product.product_ref;

  if (!productData) return null;

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 group h-full flex flex-col">
        {/* Image */}
        <div className="relative h-64 overflow-hidden">
          <ImageWithFallback
            src={imageUrl}
            alt={product.title}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />

          <div className="absolute top-4 left-4 flex flex-col gap-2">
            <Badge
              className={`${categoryColors[productData.category] || categoryColors.Merch}`}
            >
              {productData.category}
            </Badge>
            {productData.member_only && (
              <Badge className="bg-orange-500 text-white border-0 flex items-center gap-1">
                <Users className="w-3 h-3" />
                Members Only
              </Badge>
            )}
            {hasDiscount && savings > 0 && (
              <Badge className="bg-green-500 text-white border-0 flex items-center gap-1">
                <Tag className="w-3 h-3" />
                Save {savings} NOK
              </Badge>
            )}
          </div>

          {productData.stock !== null &&
            productData.stock <= 10 &&
            productData.stock > 0 && (
              <div className="absolute bottom-4 right-4 px-3 py-1 rounded-full bg-red-500/90 backdrop-blur-sm">
                <span className="text-white text-sm font-medium">
                  Only {productData.stock} left!
                </span>
              </div>
            )}

          {productData.stock === 0 && (
            <div className="absolute bottom-4 right-4 px-3 py-1 rounded-full bg-gray-900/90 backdrop-blur-sm">
              <span className="text-white text-sm font-medium">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col grow">
          <h3 className="mb-3 text-gray-900 text-xl font-semibold">
            {product.title}
          </h3>
          <p className="text-gray-600 mb-4 grow line-clamp-2 text-sm">
            {shortDescription}
          </p>

          {/* Price */}
          <div className="mb-6">
            {hasDiscount ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-400 line-through text-lg">
                  {formatPrice(productData.regular_price)}
                </span>
                <span className="text-[#3DA9E0] text-xl font-bold">
                  {formatPrice(displayPrice)}
                </span>
              </div>
            ) : (
              <div className="text-gray-900 text-xl font-bold">
                {formatPrice(displayPrice)}
              </div>
            )}

            {!isMember &&
              productData.member_price &&
              productData.member_price < productData.regular_price && (
                <p className="text-sm text-gray-500 mt-1">
                  Members pay only {formatPrice(productData.member_price)}
                </p>
              )}
          </div>

          <Button
            onClick={() => onViewDetails(product)}
            disabled={productData.stock === 0}
            className="w-full bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white border-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {productData.stock === 0 ? "Out of Stock" : "View Details"}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
