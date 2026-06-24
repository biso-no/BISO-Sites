import type {
  ContentTranslations,
  WebshopProducts,
} from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import { PLACEHOLDER_IMAGE } from "@repo/ui/lib/placeholder-images";
import { ArrowLeft, MapPin, Tag, Users } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { normalizeCampusKey } from "@/lib/shop/pickup-locations";
import {
  calculateSavings,
  formatPrice,
  getDisplayPrice,
  type ProductOption,
  parseProductMetadata,
} from "@/lib/types/webshop";
import { AddToCartClient } from "./add-to-cart-client"; // New Client Component
import { MemberCalloutClient } from "./member-callout-client"; // New Client Component
import { ProductOptionsClient } from "./product-options-client"; // New Client Component

interface ProductDetailsServerProps {
  availableStock?: number | null;
  isMember: boolean;
  product: WebshopProducts;
  userId?: string | null;
}

const categoryColors: Record<string, string> = {
  Merch: "bg-purple-100 text-purple-700 border-purple-200",
  Trips: "bg-blue-100 text-blue-700 border-blue-200",
  Lockers: "bg-green-100 text-green-700 border-green-200",
  Membership: "bg-orange-100 text-orange-700 border-orange-200",
};

// This is the main Server Component
export async function ProductDetailsServer({
  product,
  isMember,
  userId = null,
  availableStock = null,
}: ProductDetailsServerProps) {
  const t = await getTranslations("shop");
  const productRef = product;
  const translation = Array.isArray(product.translation_refs)
    ? product.translation_refs.find(
        (item): item is ContentTranslations =>
          typeof item === "object" && item !== null && "title" in item
      )
    : null;
  const title = translation?.title ?? "Untitled Product";
  const description = translation?.description ?? "";

  const metadata = parseProductMetadata(productRef.metadata);
  const productOptions = (metadata.product_options as ProductOption[]) || [];

  const regularPrice = productRef.regular_price ?? 0;
  const memberPrice = productRef.member_price;
  const displayPrice = getDisplayPrice(regularPrice, memberPrice, isMember);
  const hasDiscount =
    isMember && typeof memberPrice === "number" && memberPrice < regularPrice;
  const savings = calculateSavings(regularPrice, memberPrice);

  const campusName =
    productRef.campus && typeof productRef.campus === "object"
      ? ((productRef.campus as { name?: string | null }).name ?? null)
      : null;
  const pickupLocation = t(`pickup.campus.${normalizeCampusKey(campusName)}`);

  const imageUrl = productRef.image || PLACEHOLDER_IMAGE;

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      {/* Hero Section (SSR) */}
      <div className="relative h-[60vh] overflow-hidden">
        <ImageWithFallback
          alt={title}
          className="object-cover"
          fill
          src={imageUrl}
        />
        <div className="absolute inset-0 bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to" />

        <div className="absolute inset-0">
          <div className="mx-auto flex h-full max-w-6xl items-center px-4">
            {/* Note: The back button still needs a router hook, so this must be a Client Component or use an external link */}
            <Link href="/shop">
              <ArrowLeft className="h-5 w-5" />
              {t("product.backToShop")}
            </Link>

            <div className="mt-12">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge className={categoryColors[productRef.category ?? ""]}>
                  {productRef.category}
                </Badge>
                {productRef.member_only && (
                  <Badge className="border-0 bg-orange-500 text-white">
                    <Users className="mr-1 h-3 w-3" />
                    {t("card.membersOnly")}
                  </Badge>
                )}
                {hasDiscount && savings > 0 && (
                  <Badge className="border-0 bg-green-500 text-white">
                    <Tag className="mr-1 h-3 w-3" />
                    {t("card.save", { amount: savings })}
                  </Badge>
                )}
              </div>

              <h1 className="mb-4 font-bold text-4xl text-white md:text-5xl">
                {title}
              </h1>
              {/* Signature yellow accent under the title */}
              <div className="mb-4 h-1 w-16 rounded-full bg-brand-accent" />

              <div className="flex items-baseline gap-3">
                {hasDiscount ? (
                  <>
                    <span className="font-bold text-3xl text-white">
                      {formatPrice(displayPrice)}
                    </span>
                    <span className="text-white/60 text-xl line-through">
                      {formatPrice(regularPrice)}
                    </span>
                    <Badge className="border-0 bg-green-500 text-white">
                      {t("product.memberDiscountBadge")}
                    </Badge>
                  </>
                ) : (
                  <span className="font-bold text-3xl text-white">
                    {formatPrice(displayPrice)}
                  </span>
                )}
              </div>

              {!isMember && memberPrice && memberPrice < regularPrice && (
                <p className="mt-3 text-lg text-white/80">
                  {t("product.membersPayHint", {
                    price: formatPrice(memberPrice),
                    amount: regularPrice - memberPrice,
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-8 lg:col-span-2">
            {/* Description (SSR) */}
            <div>
              <Card className="border-0 p-8 shadow-lg">
                <h2 className="mb-4 font-bold text-2xl text-foreground">
                  {t("product.description")}
                </h2>
                <p className="whitespace-pre-line text-muted-foreground leading-relaxed">
                  {description}
                </p>
              </Card>
            </div>

            {/* Product Options (Client Component) */}
            {productOptions.length > 0 && (
              <ProductOptionsClient
                productOptions={productOptions}
                productRefId={productRef.$id}
              />
            )}

            {/* Pickup Information (SSR) */}
            <div>
              <Card className="border border-brand-border bg-brand-muted p-6 shadow-lg">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                  <div>
                    <h4 className="mb-2 font-semibold text-foreground">
                      {t("pickup.cardTitle")}
                    </h4>
                    <p className="text-muted-foreground text-sm">
                      <span className="font-medium text-foreground">
                        {t("pickup.locationLabel")}:
                      </span>{" "}
                      {pickupLocation}
                    </p>
                    <p className="mt-2 text-muted-foreground text-xs">
                      {t("pickup.emailNote")}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Add to Cart (Client Component) */}
            <AddToCartClient
              availableStock={availableStock}
              displayPrice={displayPrice}
              hasDiscount={hasDiscount}
              isMember={isMember}
              memberPrice={memberPrice}
              product={product}
              regularPrice={regularPrice}
              savings={savings}
              stock={productRef.stock}
              userId={userId}
            />

            {/* Member Benefits (Client Component) */}
            {!isMember && productRef.category !== "Membership" && (
              <MemberCalloutClient />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
