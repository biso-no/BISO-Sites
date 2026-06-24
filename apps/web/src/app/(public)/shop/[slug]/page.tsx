import { createSessionClient } from "@repo/api/server";
import type { ContentTranslations } from "@repo/api/types/appwrite";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getAvailableStock } from "@/app/actions/cart-reservations";
import { getLocale } from "@/app/actions/locale";
import { getProductBySlug } from "@/app/actions/webshop";
import { ProductDetailsServer } from "@/components/shop/product-details-server"; // New Server Component
import { getMembershipStatus } from "@/lib/actions/membership";

// Component that fetches data and renders the main content
async function ProductDetails({ slug }: { slug: string }) {
  const locale = await getLocale();

  // Fetch the product
  const product = await getProductBySlug(slug, locale);

  if (!product) {
    notFound();
  }

  // Live availability accounts for other shoppers' active reservations, so the
  // stock figure reflects what's actually buyable right now (only when the
  // product tracks stock — otherwise getAvailableStock returns Infinity).
  const [{ isMember }, sessionResult, availableStock] = await Promise.all([
    getMembershipStatus(),
    createSessionClient().then(({ account }) =>
      account.get().catch(() => null)
    ),
    product.stock === null || product.stock === undefined
      ? Promise.resolve(null)
      : getAvailableStock(product.$id),
  ]);

  return (
    <ProductDetailsServer
      availableStock={availableStock}
      isMember={isMember}
      product={product}
      userId={sessionResult?.$id ?? null}
    />
  );
}

// Skeleton loading state
function ProductDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <div className="relative h-[60vh]">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug?: string }>;
}) {
  const { slug } = await params;
  if (!slug) {
    notFound();
  }
  return (
    <Suspense fallback={<ProductDetailsSkeleton />}>
      {/* ProductDetails is the wrapper that fetches data and passes it to ProductDetailsServer */}
      <ProductDetails slug={slug} />
    </Suspense>
  );
}

// Generate metadata for SEO (remains a server-side function)
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string }>;
}) {
  const { slug } = await params;
  if (!slug) {
    notFound();
  }
  const locale = await getLocale();
  const product = await getProductBySlug(slug, locale);
  if (!product) {
    return {
      title: "Product Not Found | BISO Shop",
    };
  }

  const translation = Array.isArray(product.translation_refs)
    ? product.translation_refs.find(
        (item): item is ContentTranslations =>
          typeof item === "object" && item !== null && "title" in item
      )
    : null;

  return {
    title: `${translation?.title ?? "Product"} | BISO Shop`,
    description:
      translation?.short_description || translation?.description || "",
  };
}
