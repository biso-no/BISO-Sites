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
 * reachable client-side. The per-order marker is stored in `localStorage` (not
 * `sessionStorage`) so a refresh, a back-navigation, or reopening the success
 * URL in a new tab on the same device won't double-count revenue. (A genuinely
 * once-ever guarantee across devices would require server-side dedup, which
 * isn't warranted for a URL only the buyer normally opens.)
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
      if (window.localStorage.getItem(storageKey)) {
        return;
      }
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // localStorage may be unavailable (private mode); the ref guard still holds.
    }
    fired.current = true;
    trackPurchase({ revenue, orderId, type, campus });
  }, [campus, orderId, revenue, type]);

  return null;
}
