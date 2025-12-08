import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Suspense } from "react";
import { getActiveCampus } from "@/app/actions/campus";
import { getLocale } from "@/app/actions/locale";
import { listProducts } from "@/app/actions/webshop";
import { ShopHero } from "@/components/shop/shop-hero";
import { ShopListClient } from "@/components/shop/shop-list-client";

export const metadata = {
  title: "Shop | BISO",
  description:
    "Browse our selection of merch, trip deductibles, campus lockers, and memberships",
};

async function ShopList({
  locale,
  campus,
}: {
  locale: "en" | "no";
  campus: string | null;
}) {
  const products = await listProducts({
    locale,
    status: "published",
    limit: 100,
    campus: campus || "all",
  });

  // TODO: Get actual member status from auth
  const isMember = false;

  return <ShopListClient isMember={isMember} products={products} />;
}

function ShopListSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {[...new Array(6)].map((_, i) => (
          <div className="space-y-4" key={i}>
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function ShopPage() {
  const locale = await getLocale();
  const campus = await getActiveCampus();

  // TODO: Get actual member status from auth
  const isMember = false;

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <ShopHero isMember={isMember} />
      <Suspense fallback={<ShopListSkeleton />}>
        <ShopList campus={campus} locale={locale} />
      </Suspense>
    </div>
  );
}
