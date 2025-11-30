"use client";

import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useEffect } from "react";
import { cleanupExpiredReservations } from "@/app/actions/cart-reservations";
import { useCart } from "@/lib/contexts/cart-context";
import { CartEmptyState } from "./cart-empty-state";
import { CartList } from "./cart-list";
import { CartSummary } from "./cart-summary";

type CartPageClientProps = {
  isMember?: boolean;
  userId?: string | null;
};

export function CartPageClient({
  isMember = false,
  userId = null,
}: CartPageClientProps) {
  const { items, isLoading } = useCart();

  // Cleanup expired reservations on cart page load
  useEffect(() => {
    cleanupExpiredReservations().catch((err) => {
      console.error("Failed to cleanup expired reservations:", err);
    });
  }, []);

  if (isLoading) {
    return (
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
    );
  }

  if (items.length === 0) {
    return <CartEmptyState />;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <CartList isMember={isMember} />
      <CartSummary isMember={isMember} userId={userId} />
    </div>
  );
}
