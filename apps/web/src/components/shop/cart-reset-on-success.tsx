"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/contexts/cart-context";

/**
 * On a successful order the backend has already deleted the buyer's cart
 * reservations (applyOrderStatusTransition → deleteUserReservations). The client
 * CartContext, however, still holds the now-stale items in memory until the next
 * refresh. Rendering this on the confirmation page re-syncs the cart from the
 * server so the nav badge / drawer empty out immediately. Renders nothing.
 */
export function CartResetOnSuccess() {
  const { refreshCart } = useCart();

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  return null;
}
