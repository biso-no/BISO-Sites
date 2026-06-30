"use client";

import { trackPurchase } from "@repo/shared/utils/analytics";
import { useEffect, useRef } from "react";

interface PurchaseTrackerProps {
  campus?: string;
  orderId: string;
  revenue: number;
  type: "membership" | "merch" | "mixed";
}

/**
 * Fires Umami's revenue-driving `purchase` event once per confirmed order. Lives
 * on the order-success page (a Server Component) because `window.umami` is only
 * reachable client-side. The per-order `sessionStorage` guard (plus the mount
 * ref) prevents a page refresh or a re-render from double-counting revenue.
 */
export function PurchaseTracker({
  campus,
  orderId,
  revenue,
  type,
}: PurchaseTrackerProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) {
      return;
    }
    const storageKey = `biso-purchase-tracked:${orderId}`;
    try {
      if (window.sessionStorage.getItem(storageKey)) {
        return;
      }
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // sessionStorage may be unavailable (private mode); the ref guard still holds.
    }
    fired.current = true;
    trackPurchase({ revenue, orderId, type, campus });
  }, [campus, orderId, revenue, type]);

  return null;
}
