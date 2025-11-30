import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import { ArrowLeft, MapPin, Tag, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
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

type ProductDetailsServerProps = {
  product: ContentTranslations;
  isMember: boolean;
  // TODO: Get actual userId from auth
  userId?: string | null;
};

const categoryColors: Record<string, string> = {
  Merch: "bg-purple-100 text-purple-700 border-purple-200",
  Trips: "bg-blue-100 text-blue-700 border-blue-200",
  Lockers: "bg-green-100 text-green-700 border-green-200",
  Membership: "bg-orange-100 text-orange-700 border-orange-200",
};

// This is the main Server Component
export function ProductDetailsServer({
  product,
  isMember,
  userId = null,
}: ProductDetailsServerProps) {
  const productRef = product.product_ref;

  if (!productRef) {
    // Should be handled by ProductDetails wrapper, but for safety
    notFound();
  }

  const metadata = parseProductMetadata(productRef.metadata);
  const productOptions = (metadata.product_options as ProductOption[]) || [];

  const regularPrice = productRef.regular_price ?? 0;
  const memberPrice = productRef.member_price;
  const displayPrice = getDisplayPrice(regularPrice, memberPrice, isMember);
  const hasDiscount =
    isMember && typeof memberPrice === "number" && memberPrice < regularPrice;
  const savings = calculateSavings(regularPrice, memberPrice);

  const imageUrl =
    productRef.image ||
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1080";

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Hero Section (SSR) */}
      <div className="relative h-[60vh] overflow-hidden">
        <ImageWithFallback
          alt={product.title}
          className="object-cover"
          fill
          src={imageUrl}
        />
        <div className="absolute inset-0 bg-linear-to-br from-[#001731]/90 via-[#3DA9E0]/60 to-[#001731]/85" />

        <div className="absolute inset-0">
          <div className="mx-auto flex h-full max-w-6xl items-center px-4">
            {/* Note: The back button still needs a router hook, so this must be a Client Component or use an external link */}
            <Link href="/shop">
              <ArrowLeft className="h-5 w-5" />
              Back to Shop
            </Link>

            <div className="mt-12">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge className={categoryColors[productRef.category ?? ""]}>
                  {productRef.category}
                </Badge>
                {productRef.member_only && (
                  <Badge className="border-0 bg-orange-500 text-white">
                    <Users className="mr-1 h-3 w-3" />
                    Members Only
                  </Badge>
                )}
                {hasDiscount && savings > 0 && (
                  <Badge className="border-0 bg-green-500 text-white">
                    <Tag className="mr-1 h-3 w-3" />
                    Save {savings} NOK
                  </Badge>
                )}
              </div>

              <h1 className="mb-4 font-bold text-4xl text-white md:text-5xl">
                {product.title}
              </h1>

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
                      Member Discount
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
                  🎉 Members pay only {formatPrice(memberPrice)} - Save{" "}
                  {regularPrice - memberPrice} NOK!
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
                <h2 className="mb-4 font-bold text-2xl text-gray-900">
                  Product Description
                </h2>
                <p className="whitespace-pre-line text-gray-700 leading-relaxed">
                  {product.description}
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
              <Card className="border-0 bg-blue-50 p-6 shadow-lg">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                  <div>
                    <h4 className="mb-2 font-semibold text-gray-900">
                      Campus Pickup
                    </h4>
                    <p className="mb-2 text-gray-700 text-sm">
                      All products are available for pickup at the BISO office.
                      No shipping, no hassle!
                    </p>
                    <div className="text-gray-600 text-sm">
                      <strong>BISO Office:</strong> Main Building, Ground Floor
                      <br />
                      <strong>Hours:</strong> Monday-Friday, 10:00-16:00
                      <br />
                      <strong>Pickup:</strong> Within 5 working days of purchase
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Add to Cart (Client Component) */}
            <AddToCartClient
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
