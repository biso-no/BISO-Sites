"use client";

import { resolveStorageFileUrl } from "@repo/api/storage";
import type {
  ContentTranslations,
  WebshopProducts,
} from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { ChevronRight, ShoppingBag, Tag } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { buildTeaser } from "@/lib/content-text";

const PRODUCT_TEASER_MAX_LENGTH = 120;

interface ProductsTabProps {
  isMember: boolean;
  products: WebshopProducts[];
}

const StockBadge = ({ stock }: { stock?: number | null }) => {
  const t = useTranslations("units.detail");
  if (stock === null || stock === undefined) {
    return null;
  }
  if (stock === 0) {
    return (
      <Badge className="absolute right-4 bottom-4 border-0 bg-red-500 text-white">
        {t("products.soldOut")}
      </Badge>
    );
  }
  if (stock < 20) {
    return (
      <Badge className="absolute right-4 bottom-4 border-0 bg-orange-500 text-white">
        Only {stock} left!
      </Badge>
    );
  }
  return null;
};

const ProductPrice = ({
  productRef,
  isMember,
}: {
  productRef: WebshopProducts;
  isMember: boolean;
}) => {
  if (!productRef) {
    return null;
  }
  if (productRef.member_price && isMember) {
    return (
      <div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground text-xl">
            {productRef.member_price} NOK
          </span>
          <Badge
            className="border-green-200 bg-green-50 text-green-700 text-xs dark:border-green-800 dark:bg-green-950 dark:text-green-400"
            variant="outline"
          >
            Member
          </Badge>
        </div>
        <span className="text-muted-foreground text-sm line-through">
          {productRef.regular_price} NOK
        </span>
      </div>
    );
  }

  return (
    <div>
      <span className="font-bold text-foreground text-xl">
        {productRef.regular_price || 0} NOK
      </span>
      {productRef.member_price && !isMember && (
        <div className="mt-1 text-muted-foreground text-xs">
          {productRef.member_price} NOK for members
        </div>
      )}
    </div>
  );
};

const ProductCard = ({
  product,
  isMember,
  index,
}: {
  product: WebshopProducts;
  isMember: boolean;
  index: number;
}) => {
  const t = useTranslations("units.detail");
  const productRef = product;
  const translation = Array.isArray(product.translation_refs)
    ? product.translation_refs.find(
        (item): item is ContentTranslations =>
          typeof item === "object" && item !== null && "title" in item
      )
    : null;
  const imageUrl = resolveStorageFileUrl(productRef?.image);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: 20 }}
      key={product.$id}
      transition={{ delay: index * 0.1 }}
    >
      <Link href={`/shop/${productRef?.slug || product.$id}`}>
        <Card className="group cursor-pointer overflow-hidden border-0 shadow-lg transition-all hover:shadow-xl">
          <div className="relative h-64 overflow-hidden bg-muted">
            {imageUrl && (
              <ImageWithFallback
                alt={translation?.title || "Product"}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                fill
                src={imageUrl}
              />
            )}
            {productRef?.member_only && (
              <Badge className="absolute top-4 left-4 border-0 bg-deep text-white">
                {t("products.membersOnly")}
              </Badge>
            )}
            {productRef?.category && (
              <Badge className="absolute top-4 right-4 border-0 bg-brand text-white">
                <Tag className="mr-1 h-3 w-3" />
                {productRef.category}
              </Badge>
            )}
            <StockBadge stock={productRef?.stock} />
          </div>

          <div className="p-6">
            <h3 className="mb-2 font-semibold text-foreground text-xl transition-colors group-hover:text-brand">
              {translation?.title || "Untitled Product"}
            </h3>
            <p className="mb-4 line-clamp-2 text-muted-foreground text-sm">
              {buildTeaser(
                translation?.short_description,
                translation?.description,
                PRODUCT_TEASER_MAX_LENGTH
              )}
            </p>

            <Separator className="my-4" />

            <div className="flex items-center justify-between">
              <ProductPrice isMember={isMember} productRef={productRef} />
              <Button
                className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={productRef?.stock === 0}
                size="sm"
              >
                {productRef?.stock === 0 ? "Sold Out" : "View"}
                {productRef?.stock !== 0 && (
                  <ChevronRight className="ml-1 h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
};

export function ProductsTab({ products, isMember }: ProductsTabProps) {
  const t = useTranslations("units.detail");
  return (
    <div className="space-y-8">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
        initial={{ opacity: 0, y: 20 }}
      >
        <h2 className="mb-4 font-bold text-3xl text-foreground">
          {t("products.title")}
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          {t("products.subtitle")}
        </p>
      </motion.div>

      {products.length > 0 ? (
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product, index) => (
            <ProductCard
              index={index}
              isMember={isMember}
              key={product.$id}
              product={product}
            />
          ))}
        </div>
      ) : (
        <Card className="border-0 p-12 text-center shadow-lg">
          <ShoppingBag className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h3 className="mb-2 font-semibold text-foreground text-xl">
            {t("products.emptyTitle")}
          </h3>
          <p className="text-muted-foreground">{t("products.emptyBody")}</p>
        </Card>
      )}
    </div>
  );
}
