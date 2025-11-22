"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { AlertCircle, Package, Tag, Users } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { useCallback, useMemo } from "react";

type ProductFormData = {
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
};

type ProductPreviewProps = {
  data: ProductFormData;
  locale: "en" | "no";
};

const categoryColors: Record<string, string> = {
  Merch: "bg-purple-100 text-purple-700 border-purple-200",
  Trips: "bg-blue-100 text-blue-700 border-blue-200",
  Lockers: "bg-green-100 text-green-700 border-green-200",
  Membership: "bg-orange-100 text-orange-700 border-orange-200",
};

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function ProductImage({
  data,
  title,
}: {
  data: ProductFormData;
  title: string;
}) {
  const imageUrl =
    data.metadata?.images?.[0] || data.image || "/images/placeholder.jpg";

  return (
    <div className="relative aspect-4/3 w-full overflow-hidden bg-gray-100">
      <Image
        alt={title || "Product preview"}
        className="object-cover"
        fill
        sizes="400px"
        src={imageUrl}
      />

      {/* Category Badge */}
      {data.category && (
        <div className="absolute top-3 left-3">
          <Badge
            className={cn(
              "border font-medium",
              categoryColors[data.category] ||
                "border-gray-200 bg-gray-100 text-gray-700"
            )}
          >
            <Tag className="mr-1 h-3 w-3" />
            {data.category}
          </Badge>
        </div>
      )}

      {/* Member Only Badge */}
      {data.member_only && (
        <div className="absolute top-3 right-3">
          <Badge className="border-blue-200 bg-blue-50 font-medium text-blue-700">
            <Users className="mr-1 h-3 w-3" />
            Members Only
          </Badge>
        </div>
      )}

      {/* Stock Warning */}
      {data.stock !== undefined && data.stock > 0 && data.stock <= 10 && (
        <div className="absolute right-3 bottom-3 rounded-full bg-orange-500/90 px-3 py-1 backdrop-blur-sm">
          <span className="font-medium text-white text-xs">
            <Package className="mr-1 inline h-3 w-3" />
            {data.stock} left!
          </span>
        </div>
      )}

      {data.stock === 0 && (
        <div className="absolute right-3 bottom-3 rounded-full bg-gray-900/90 px-3 py-1 backdrop-blur-sm">
          <span className="font-medium text-white text-xs">Out of Stock</span>
        </div>
      )}
    </div>
  );
}

function ProductInfo({
  data,
  locale,
  title,
  description,
}: {
  data: ProductFormData;
  locale: "en" | "no";
  title: string;
  description: string;
}) {
  const displayPrice =
    data.member_price && data.member_price < data.regular_price
      ? data.member_price
      : data.regular_price;
  const hasDiscount =
    data.member_price && data.member_price < data.regular_price;

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("nb-NO", {
      style: "currency",
      currency: "NOK",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);

  return (
    <div className="space-y-3 p-4">
      {/* Title */}
      <h3 className="line-clamp-2 font-semibold text-gray-900 text-lg">
        {title || (locale === "en" ? "Product Title" : "Produkttittel")}
      </h3>

      {/* Description */}
      <p className="line-clamp-2 text-gray-600 text-sm">
        {description ||
          (locale === "en"
            ? "Product description..."
            : "Produktbeskrivelse...")}
      </p>

      {/* Price */}
      <div className="flex items-center gap-2">
        {hasDiscount ? (
          <>
            <span className="text-gray-400 text-lg line-through">
              {formatPrice(data.regular_price)}
            </span>
            <span className="font-bold text-[#3DA9E0] text-xl">
              {formatPrice(displayPrice)}
            </span>
            <Badge className="ml-auto text-xs" variant="secondary">
              Save {formatPrice(data.regular_price - displayPrice)}
            </Badge>
          </>
        ) : (
          <span className="font-bold text-gray-900 text-xl">
            {formatPrice(displayPrice)}
          </span>
        )}
      </div>

      {/* Additional Info */}
      <div className="flex flex-wrap gap-2 border-t pt-2">
        {data.metadata?.sku && (
          <Badge className="font-mono text-xs" variant="outline">
            SKU: {data.metadata.sku}
          </Badge>
        )}
        {data.metadata?.max_per_user === 1 && (
          <Badge className="text-xs" variant="outline">
            <AlertCircle className="mr-1 h-3 w-3" />1 per customer
          </Badge>
        )}
        {data.metadata?.max_per_order && (
          <Badge className="text-xs" variant="outline">
            Max {data.metadata.max_per_order} per order
          </Badge>
        )}
      </div>
    </div>
  );
}

export function ProductPreview({ data, locale }: ProductPreviewProps) {
  const translation = data.translations[locale];

  // Strip HTML tags for preview description
  const stripHtml = useCallback((html: string) => {
    if (typeof window === "undefined") {
      return ""; // SSR check
    }
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }, []);

  const shortDescription = useMemo(() => {
    const plainText = stripHtml(translation.description);
    return plainText.length > 100
      ? `${plainText.substring(0, 100)}...`
      : plainText;
  }, [translation.description, stripHtml]);

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="relative"
      initial={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Status Badge Overlay */}
      {data.status !== "published" && (
        <div className="absolute top-2 right-2 z-10">
          <Badge
            className="font-semibold text-xs uppercase"
            variant={data.status === "draft" ? "secondary" : "destructive"}
          >
            {data.status}
          </Badge>
        </div>
      )}

      {/* Product Card */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md">
        <ProductImage data={data} title={translation.title} />
        <ProductInfo
          data={data}
          description={shortDescription}
          locale={locale}
          title={translation.title}
        />
      </div>

      {/* Preview Note */}
      <p className="mt-2 text-center text-muted-foreground text-xs italic">
        {locale === "en" ? "Live Preview" : "Forhåndsvisning"}
      </p>
    </motion.div>
  );
}
