import { createSessionClient } from "@repo/api/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getAvailableStock } from "@/app/actions/cart-reservations";
import { getLocale } from "@/app/actions/locale";
import { getProductDetailBySlug } from "@/app/actions/webshop";
import { ProductDetailV2 } from "@/components/shop/v2/product-detail-v2";
import { DetailSkeleton } from "@/components/ui/loading-shell";
import { getMembershipStatus } from "@/lib/actions/membership";
import { buildTeaser } from "@/lib/content-text";
import { getPrimaryTranslation } from "@/lib/content-translation";

/** Roughly what a search result shows before it cuts the description. */
const META_DESCRIPTION_LENGTH = 160;

// Component that fetches data and renders the main content
async function ProductDetails({ slug }: { slug: string }) {
  const locale = await getLocale();

  // The v2 reader keeps every translation; `getProductBySlug` filters them to
  // the requested locale, which leaves 52 of the 55 products with no copy at
  // all for an English reader. Like it, this serves a link-only (`unlisted`)
  // product: it is absent from every listing but sold at this URL.
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
  // The same all-locale reader as the page. The locale-filtered
  // `getProductBySlug` returns nothing for a reader whose language has no
  // translation row, which titled a real product "Product Not Found" — and
  // dropped the `noindex` a link-only product must carry.
  const [locale, product] = await Promise.all([
    getLocale(),
    getProductDetailBySlug(slug),
  ]);
  if (!product) {
    return {
      title: "Product Not Found | BISO Shop",
    };
  }

  const translation = getPrimaryTranslation(product, locale);

  return {
    title: `${translation?.title ?? "Product"} | BISO Shop`,
    // Both fields are CMS rich text; a meta description carries no markup and
    // reads as a teaser, not the whole body.
    description: buildTeaser(
      translation?.short_description,
      translation?.description,
      META_DESCRIPTION_LENGTH
    ),
    // A link-only product is kept out of the sitemap and every listing, so it
    // should not be indexed if a shared link is ever crawled. `follow: false`
    // keeps a crawler from walking on into the checkout from here.
    ...(product.unlisted ? { robots: { follow: false, index: false } } : {}),
  };
}
