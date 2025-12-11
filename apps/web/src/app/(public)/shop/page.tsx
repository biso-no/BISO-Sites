import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Suspense } from "react";
import { listProducts } from "@/app/actions/webshop";
import { ShopHero } from "@/components/shop/shop-hero";
import { ShopListClient } from "@/components/shop/shop-list-client";
import { getUserPreferences } from "@/lib/auth-utils";
import { Locale } from "@repo/api/types/appwrite";

export const metadata = {
  title: "Shop | BISO",
  description:
    "Browse our selection of merch, trip deductibles, campus lockers, and memberships",
};

async function ShopList({
  locale,
  campus,
  isMember,
}: {
  locale: Locale;
  campus: string | null;
  isMember: boolean;
}) {
  const products = await listProducts({
    locale,
    status: "published",
    limit: 100,
    campus: campus || "all",
  });

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
  const prefs = await getUserPreferences();

  // TODO: Get actual member status from auth
  const isMember = false;

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <ShopHero isMember={isMember} />
      <Suspense fallback={<ShopListSkeleton />}>
        <ShopList
          campus={prefs?.campusId ?? "all"}
          locale={prefs?.locale ?? Locale.EN}
          isMember={isMember}
        />
      </Suspense>
    </div>
  );
}
