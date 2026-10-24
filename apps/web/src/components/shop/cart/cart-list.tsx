"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/contexts/cart-context";
import { CartItem } from "./cart-item";

export function CartList({ isMember }: { isMember: boolean }) {
  const t = useTranslations("shop");
  const {
    items,
    updateQuantity,
    removeItem,
    getEarliestExpiration,
    refreshCart,
  } = useCart();
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  // Countdown timer for cart expiration
  useEffect(() => {
    const updateCountdown = () => {
      const earliestExpiration = getEarliestExpiration();

      if (!earliestExpiration) {
        setTimeRemaining(null);
        return;
      }

      const now = Date.now();
      const expirationTime = new Date(earliestExpiration).getTime();
      const diff = expirationTime - now;

      if (diff <= 0) {
        setTimeRemaining(t("cart.list.expired"));
        // Refresh cart to remove expired items
        refreshCart();
        return;
      }

      const minutes = Math.floor(diff / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [getEarliestExpiration, refreshCart, t]);

  const handleQuantityChange = (itemId: string, change: number) => {
    const item = items.find((i) => i.id === itemId);
    if (item) {
      updateQuantity(itemId, item.quantity + change);
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      {/* How long the stock is held for. Not a live region: it ticks every
          second, and a screen reader announcing each tick drowns the page. */}
      {timeRemaining ? (
        <p className="type-body-sm flex flex-wrap items-center gap-2 rounded-biso-md border border-edge bg-surface-sunken p-4 text-ink">
          <Clock
            aria-hidden="true"
            className="size-4 shrink-0 text-ink-accent"
          />
          <span className="font-semibold">{t("cart.list.reservedFor")}</span>
          <span className="type-data">{timeRemaining}</span>
        </p>
      ) : null}

      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.id}>
            <CartItem
              isMember={isMember}
              item={item}
              onRemove={removeItem}
              onUpdateQuantity={handleQuantityChange}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
