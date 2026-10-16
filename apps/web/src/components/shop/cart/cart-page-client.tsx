"use client";

import { useEffect } from "react";
import { cleanupExpiredReservations } from "@/app/actions/cart-reservations";
import { useCart } from "@/lib/contexts/cart-context";
import { CartEmptyState } from "./cart-empty-state";
import { CartList } from "./cart-list";
import { CartSummary } from "./cart-summary";

interface CartPageClientProps {
  isMember?: boolean;
  userId?: string | null;
}

/** Still blocks where the rows and the summary will be — no pulse (RD-020). */
function CartSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <div className="space-y-4">
        <div className="h-36 rounded-biso-md bg-surface-sunken" />
        <div className="h-36 rounded-biso-md bg-surface-sunken" />
      </div>
      <div className="h-72 rounded-biso-md bg-surface-sunken" />
    </div>
  );
}

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
    return <CartSkeleton />;
  }

  if (items.length === 0) {
    return <CartEmptyState />;
  }

  // The items, then a summary that rides beside them on a wide screen — the
  // same list-plus-sticky-rail shape as the product page and checkout.
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <CartList isMember={isMember} />
      <CartSummary isMember={isMember} userId={userId} />
    </div>
  );
}
