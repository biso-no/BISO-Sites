"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { AlertCircle, Package, Tag, Users } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { useMemo } from "react";

interface ProductFormData {
  slug: string;
  status: "draft" | "published" | "archived";
  campus_id: string;
  category: string;
  regular_price: number;
  member_price?: number;
  member_only?: boolean;
  stock?: number;
  image?: string;
  metadata?: {
    sku?: string;
    images?: string[];
    max_per_user?: number;
    max_per_order?: number;
  };
  translations: {
    en: {
      title: string;
      description: string;
    };
    no: {
      title: string;
      description: string;
    };
  };
}

interface ProductPreviewProps {
  data: ProductFormData;
  locale: "en" | "no";
}

const categoryColors: Record<string, string> = {
  Merch: "bg-purple-100 text-purple-700 border-purple-200",
  Trips: "bg-blue-100 text-blue-700 border-blue-200",
  Lockers: "bg-green-100 text-green-700 border-green-200",
  Membership: "bg-orange-100 text-orange-700 border-orange-200",
};

export function ProductPreview({ data, locale }: ProductPreviewProps) {
  const translation = data.translations[locale];
  const displayPrice =
    data.member_price && data.member_price < data.regular_price
      ? data.member_price
      : data.regular_price;
  const hasDiscount = data.member_price && data.member_price < data.regular_price;
  const imageUrl = data.metadata?.images?.[0] || data.image || "/images/placeholder.jpg";

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("nb-NO", {
      style: "currency",
      currency: "NOK",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Strip HTML tags for preview description
  const stripHtml = (html: string) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const shortDescription = useMemo(() => {
    const plainText = stripHtml(translation.description);
    return plainText.length > 100 ? `${plainText.substring(0, 100)}...` : plainText;
  }, [translation.description]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="relative"
    >
      {/* Status Badge Overlay */}
      {data.status !== "published" && (
        <div className="absolute top-2 right-2 z-10">
          <Badge
            variant={data.status === "draft" ? "secondary" : "destructive"}
            className="font-semibold uppercase text-xs"
          >
            {data.status}
          </Badge>
        </div>
      )}

      {/* Product Card */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md">
        {/* Image */}
        <div className="relative aspect-4/3 w-full overflow-hidden bg-gray-100">
          <Image
            src={imageUrl}
            alt={translation.title || "Product preview"}
            fill
            className="object-cover"
            sizes="400px"
          />

          {/* Category Badge */}
          {data.category && (
            <div className="absolute left-3 top-3">
              <Badge
                className={cn(
                  "border font-medium",
                  categoryColors[data.category] || "bg-gray-100 text-gray-700 border-gray-200",
                )}
              >
                <Tag className="mr-1 h-3 w-3" />
                {data.category}
              </Badge>
            </div>
          )}

          {/* Member Only Badge */}
          {data.member_only && (
            <div className="absolute right-3 top-3">
              <Badge className="border-blue-200 bg-blue-50 text-blue-700 font-medium">
                <Users className="mr-1 h-3 w-3" />
                Members Only
              </Badge>
            </div>
          )}

          {/* Stock Warning */}
          {data.stock !== undefined && data.stock > 0 && data.stock <= 10 && (
            <div className="absolute bottom-3 right-3 rounded-full bg-orange-500/90 px-3 py-1 backdrop-blur-sm">
              <span className="text-xs font-medium text-white">
                <Package className="mr-1 inline h-3 w-3" />
                {data.stock} left!
              </span>
            </div>
          )}

          {data.stock === 0 && (
            <div className="absolute bottom-3 right-3 rounded-full bg-gray-900/90 px-3 py-1 backdrop-blur-sm">
              <span className="text-xs font-medium text-white">Out of Stock</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
            {translation.title || (locale === "en" ? "Product Title" : "Produkttittel")}
          </h3>

          {/* Description */}
          <p className="text-sm text-gray-600 line-clamp-2">
            {shortDescription ||
              (locale === "en" ? "Product description..." : "Produktbeskrivelse...")}
          </p>

          {/* Price */}
          <div className="flex items-center gap-2">
            {hasDiscount ? (
              <>
                <span className="text-lg text-gray-400 line-through">
                  {formatPrice(data.regular_price)}
                </span>
                <span className="text-xl font-bold text-[#3DA9E0]">
                  {formatPrice(displayPrice)}
                </span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  Save {formatPrice(data.regular_price - displayPrice)}
                </Badge>
              </>
            ) : (
              <span className="text-xl font-bold text-gray-900">{formatPrice(displayPrice)}</span>
            )}
          </div>

          {/* Additional Info */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {data.metadata?.sku && (
              <Badge variant="outline" className="text-xs font-mono">
                SKU: {data.metadata.sku}
              </Badge>
            )}
            {data.metadata?.max_per_user === 1 && (
              <Badge variant="outline" className="text-xs">
                <AlertCircle className="mr-1 h-3 w-3" />1 per customer
              </Badge>
            )}
            {data.metadata?.max_per_order && (
              <Badge variant="outline" className="text-xs">
                Max {data.metadata.max_per_order} per order
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Preview Note */}
      <p className="mt-2 text-center text-xs text-muted-foreground italic">
        {locale === "en" ? "Live Preview" : "Forhåndsvisning"}
      </p>
    </motion.div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
