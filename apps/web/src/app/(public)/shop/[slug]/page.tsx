import { createSessionClient } from "@repo/api/server";
import type { ContentTranslations } from "@repo/api/types/appwrite";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getAvailableStock } from "@/app/actions/cart-reservations";
import { getLocale } from "@/app/actions/locale";
import {
  getProductBySlug,
  getProductDetailBySlug,
} from "@/app/actions/webshop";
import { ProductDetailV2 } from "@/components/shop/v2/product-detail-v2";
import { DetailSkeleton } from "@/components/ui/loading-shell";
import { getMembershipStatus } from "@/lib/actions/membership";

// Component that fetches data and renders the main content
async function ProductDetails({ slug }: { slug: string }) {
  const locale = await getLocale();

  // The v2 reader keeps every translation; `getProductBySlug` filters them to
  // the requested locale, which leaves 52 of the 55 products with no copy at
  // all for an English reader.
  const product = await getProductDetailBySlug(slug);

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
    <ProductDetailV2
      availableStock={availableStock}
      isMember={isMember}
      locale={locale}
      product={product}
      userId={sessionResult?.$id ?? null}
    />
  );
}

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
    <Suspense fallback={<DetailSkeleton />}>
      <ProductDetails slug={slug} />
    </Suspense>
  );
}

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
