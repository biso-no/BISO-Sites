import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale } from "@/app/actions/locale";
import { getProductBySlug } from "@/app/actions/webshop";
import { ProductDetailsServer } from "@/components/shop/product-details-server"; // New Server Component

// Component that fetches data and renders the main content
async function ProductDetails({ slug }: { slug: string }) {
  const locale = await getLocale();

  // Fetch the product
  const product = await getProductBySlug(slug, locale);

  if (!product) {
    notFound();
  }

  // TODO: Get actual member status from auth
  const isMember = false;

  return <ProductDetailsServer isMember={isMember} product={product} />;
}

// Skeleton loading state
function ProductDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
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
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const locale = await getLocale();
  const product = await getProductBySlug(slug?.[0] ?? "", locale);
  if (!slug?.[0]) {
    notFound();
  }
  if (!product) {
    return {
      title: "Product Not Found | BISO Shop",
    };
  }

  return {
    title: `${product.title} | BISO Shop`,
    description: product.short_description || product.description,
  };
}
