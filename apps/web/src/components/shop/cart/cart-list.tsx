"use client";

import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Clock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/contexts/cart-context";
import { CartItem } from "./cart-item";

export function CartList({ isMember }: { isMember: boolean }) {
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
        setTimeRemaining("Expired");
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
  }, [getEarliestExpiration, refreshCart]);

  const handleQuantityChange = (itemId: string, change: number) => {
    const item = items.find((i) => i.id === itemId);
    if (item) {
      updateQuantity(itemId, item.quantity + change);
    }
  };

  return (
    <div className="space-y-4 lg:col-span-2">
      {/* Countdown Timer */}
      {timeRemaining && (
        <Alert className="border-blue-200 bg-blue-50">
          <Clock className="h-4 w-4 text-blue-600" />
          <AlertDescription className="flex items-center gap-2 text-blue-800">
            <span className="font-medium">Items reserved for:</span>
            <span className="font-bold font-mono">{timeRemaining}</span>
          </AlertDescription>
        </Alert>
      )}

      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -100 }}
            initial={{ opacity: 0, y: 20 }}
            key={item.id}
            layout
            transition={{ duration: 0.2 }}
          >
            <CartItem
              isMember={isMember}
              item={item}
              onRemove={removeItem}
              onUpdateQuantity={handleQuantityChange}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
