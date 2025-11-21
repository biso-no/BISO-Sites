import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Suspense } from "react";
import { CartPageClient } from "@/components/shop/cart-page-client";

export const metadata = {
  title: "Shopping Cart | BISO Shop",
  description: "Review your items and proceed to checkout",
};

function CartSkeleton() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      <div className="relative h-[40vh]">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CartPage() {
  // TODO: Get actual member status from auth
  const isMember = false;

  return (
    <Suspense fallback={<CartSkeleton />}>
      <CartPageClient isMember={isMember} />
    </Suspense>
  );
}
