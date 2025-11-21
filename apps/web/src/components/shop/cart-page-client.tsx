"use client";

import { Currency } from "@repo/api/types/appwrite";
import { initiateVippsCheckout } from "@repo/payment/actions";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  CreditCard,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  Sparkles,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { cleanupExpiredReservations } from "@/app/actions/cart-reservations";
import { useCart } from "@/lib/contexts/cart-context";

type CartPageClientProps = {
  isMember?: boolean;
  userId?: string | null;
};

const categoryColors: Record<string, string> = {
  Merch: "bg-purple-100 text-purple-700 border-purple-200",
  Trips: "bg-blue-100 text-blue-700 border-blue-200",
  Lockers: "bg-green-100 text-green-700 border-green-200",
  Membership: "bg-orange-100 text-orange-700 border-orange-200",
};

export function CartPageClient({
  isMember = false,
  userId = null,
}: CartPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const {
    items,
    isLoading,
    updateQuantity,
    removeItem,
    getSubtotal,
    getRegularSubtotal,
    getTotalSavings,
    getEarliestExpiration,
    refreshCart,
  } = useCart();
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  const subtotal = getSubtotal(isMember);
  const regularSubtotal = getRegularSubtotal();
  const totalSavings = getTotalSavings(isMember);
  const discountTotal = isMember ? totalSavings : 0;

  const hasUnlockableDiscounts =
    !isMember && items.some((item) => item.memberPrice);
  const potentialSavings = isMember
    ? 0
    : regularSubtotal -
      items.reduce((sum, item) => {
        const price = item.memberPrice || item.regularPrice;
        return sum + price * item.quantity;
      }, 0);

  // Get error from URL
  const error = searchParams.get("error");
  const cancelled = searchParams.get("cancelled");

  // Cleanup expired reservations on cart page load
  useEffect(() => {
    cleanupExpiredReservations().catch((err) => {
      console.error("Failed to cleanup expired reservations:", err);
    });
  }, []);

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

  const handleCheckout = () => {
    startTransition(async () => {
      await initiateVippsCheckout({
        userId: userId || "guest", // TODO: Get from auth session
        items: items.map((item) => ({
          productId: item.productId,
          name: item.name,
          price:
            isMember && item.memberPrice ? item.memberPrice : item.regularPrice,
          quantity: item.quantity,
        })),
        subtotal: regularSubtotal,
        discountTotal: discountTotal || undefined,
        total: subtotal,
        currency: Currency.NOK,
        membershipApplied: isMember,
        memberDiscountPercent:
          isMember && totalSavings > 0
            ? Math.round((totalSavings / regularSubtotal) * 100)
            : undefined,
        // TODO: Add customer info from user profile
      });
    });
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="relative h-[40vh] overflow-hidden">
        <ImageWithFallback
          alt="Shopping Cart"
          className="h-full w-full object-cover"
          fill
          src="https://images.unsplash.com/photo-1472851294608-062f824d29cc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaG9wcGluZyUyMGNhcnR8ZW58MXx8fHwxNzYyMTY1MTQ1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
        />
        <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90" />

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <motion.button
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-8 left-8 flex items-center gap-2 text-white transition-colors hover:text-[#3DA9E0]"
              initial={{ opacity: 0, x: -20 }}
              onClick={() => router.push("/shop")}
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Shop
            </motion.button>

            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.8 }}
            >
              <div className="mb-4 flex items-center justify-center gap-2">
                <ShoppingCart className="h-12 w-12 text-[#3DA9E0]" />
              </div>
              <h1 className="mb-4 font-bold text-4xl text-white md:text-5xl">
                Your Cart
              </h1>
              <p className="text-lg text-white/90">
                {items.length} {items.length === 1 ? "item" : "items"} ready for
                pickup
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12">
        {/* Error Messages */}
        {error === "checkout_failed" && (
          <Alert className="mb-6" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to create checkout session. Please try again or contact
              support if the problem persists.
            </AlertDescription>
          </Alert>
        )}

        {error === "payment_failed" && (
          <Alert className="mb-6" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Payment failed. Please try again or use a different payment
              method.
            </AlertDescription>
          </Alert>
        )}

        {cancelled === "true" && (
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              Payment was cancelled. Your cart items are still here when
              you&apos;re ready to checkout.
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          // Loading State
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
        ) : items.length === 0 ? (
          // Empty Cart
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="py-16 text-center"
            initial={{ opacity: 0, y: 20 }}
          >
            <ShoppingCart className="mx-auto mb-6 h-24 w-24 text-gray-300" />
            <h2 className="mb-4 font-bold text-2xl text-gray-900">
              Your cart is empty
            </h2>
            <p className="mb-8 text-gray-600 text-lg">
              Start adding some amazing BISO products to your cart!
            </p>
            <Button
              className="bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90"
              onClick={() => router.push("/shop")}
            >
              Continue Shopping
            </Button>
          </motion.div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Cart Items */}
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
                {items.map((item, index) => {
                  const itemPrice =
                    isMember && item.memberPrice
                      ? item.memberPrice
                      : item.regularPrice;
                  const itemTotal = itemPrice * item.quantity;
                  const hasDiscount =
                    isMember &&
                    item.memberPrice &&
                    item.memberPrice < item.regularPrice;
                  const savings = hasDiscount
                    ? (item.regularPrice - (item.memberPrice ?? 0)) *
                      item.quantity
                    : 0;

                  return (
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      initial={{ opacity: 0, y: 20 }}
                      key={item.id}
                      layout
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="border-0 p-6 shadow-lg">
                        <div className="flex gap-6">
                          {/* Product Image */}
                          <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-lg">
                            <ImageWithFallback
                              alt={item.name}
                              className="object-cover"
                              fill
                              src={
                                item.image ||
                                "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1080"
                              }
                            />
                            <Badge
                              className={`absolute top-2 left-2 ${categoryColors[item.category]}`}
                            >
                              {item.category}
                            </Badge>
                          </div>

                          {/* Product Details */}
                          <div className="grow">
                            <div className="mb-2 flex items-start justify-between">
                              <div>
                                <h3 className="mb-1 font-semibold text-gray-900">
                                  {item.name}
                                </h3>
                                {item.memberOnly && (
                                  <Badge className="mb-2 border-0 bg-orange-500 text-white">
                                    <Users className="mr-1 h-3 w-3" />
                                    Members Only
                                  </Badge>
                                )}
                              </div>
                              <Button
                                className="text-red-500 hover:bg-red-50 hover:text-red-700"
                                onClick={() => removeItem(item.id)}
                                size="sm"
                                variant="ghost"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Selected Options */}
                            {item.selectedOptions &&
                              Object.keys(item.selectedOptions).length > 0 && (
                                <div className="mb-3 rounded-lg bg-gray-50 p-3">
                                  <p className="mb-1 text-gray-500 text-sm">
                                    Selected options:
                                  </p>
                                  {Object.entries(item.selectedOptions).map(
                                    ([key, value]) => (
                                      <p
                                        className="text-gray-700 text-sm"
                                        key={key}
                                      >
                                        <strong>{key}:</strong> {value}
                                      </p>
                                    )
                                  )}
                                </div>
                              )}

                            {/* Price and Quantity */}
                            <div className="mt-4 flex items-center justify-between">
                              {/* Quantity Control */}
                              <div className="flex items-center gap-3">
                                <span className="text-gray-600 text-sm">
                                  Quantity:
                                </span>
                                <div className="flex items-center gap-2 rounded-lg border border-gray-300">
                                  <Button
                                    className="h-8 w-8 p-0 disabled:opacity-50"
                                    disabled={item.quantity <= 1}
                                    onClick={() =>
                                      handleQuantityChange(item.id, -1)
                                    }
                                    size="sm"
                                    variant="ghost"
                                  >
                                    <Minus className="h-4 w-4 text-gray-900 hover:text-blue-800" />
                                  </Button>
                                  <span className="w-8 text-center font-medium text-gray-900">
                                    {item.quantity}
                                  </span>
                                  <Button
                                    className="h-8 w-8 p-0 disabled:opacity-50"
                                    disabled={
                                      (item.stock !== null &&
                                        item.quantity >= item.stock) ||
                                      (item.metadata?.max_per_order !==
                                        undefined &&
                                        item.quantity >=
                                          item.metadata.max_per_order)
                                    }
                                    onClick={() =>
                                      handleQuantityChange(item.id, 1)
                                    }
                                    size="sm"
                                    variant="ghost"
                                  >
                                    <Plus className="h-4 w-4 text-gray-900 hover:text-blue-800" />
                                  </Button>
                                </div>
                                {item.stock !== null && item.stock <= 10 && (
                                  <span className="text-orange-600 text-xs">
                                    Only {item.stock} available
                                  </span>
                                )}
                                {item.metadata?.max_per_order &&
                                  item.quantity >=
                                    item.metadata.max_per_order && (
                                    <span className="text-red-600 text-xs">
                                      Max {item.metadata.max_per_order} per
                                      order
                                    </span>
                                  )}
                              </div>

                              {/* Price */}
                              <div className="text-right">
                                {hasDiscount ? (
                                  <div>
                                    <div className="text-gray-400 text-sm line-through">
                                      {item.regularPrice * item.quantity} NOK
                                    </div>
                                    <div className="font-bold text-[#3DA9E0]">
                                      {itemTotal} NOK
                                    </div>
                                    <div className="text-green-600 text-xs">
                                      Save {savings} NOK
                                    </div>
                                  </div>
                                ) : (
                                  <div className="font-bold text-gray-900">
                                    {itemTotal} NOK
                                  </div>
                                )}
                                {!isMember &&
                                  item.memberPrice &&
                                  item.memberPrice < item.regularPrice && (
                                    <div className="mt-1 text-gray-500 text-xs">
                                      Members:{" "}
                                      {item.memberPrice * item.quantity} NOK
                                    </div>
                                  )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Order Summary */}
            <div className="space-y-6">
              {/* Member Benefits Alert */}
              {hasUnlockableDiscounts && potentialSavings > 0 && (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  initial={{ opacity: 0, y: 20 }}
                >
                  <Alert className="border-[#3DA9E0] bg-linear-to-br from-[#3DA9E0]/10 to-cyan-50">
                    <Sparkles className="h-4 w-4 text-[#3DA9E0]" />
                    <AlertDescription>
                      <p className="mb-2 text-gray-900 text-sm">
                        <strong>Unlock member discounts!</strong>
                      </p>
                      <p className="mb-3 text-gray-600 text-sm">
                        You could save {potentialSavings} NOK on this order by
                        becoming a BISO member.
                      </p>
                      <Button
                        className="w-full bg-[#3DA9E0] text-white hover:bg-[#3DA9E0]/90"
                        onClick={() => router.push("/shop?category=Membership")}
                        size="sm"
                      >
                        Join BISO - From 350 NOK
                      </Button>
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}

              {/* Order Summary Card */}
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 20 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="sticky top-24 border-0 p-6 shadow-lg">
                  <h3 className="mb-4 font-bold text-gray-900 text-xl">
                    Order Summary
                  </h3>

                  <div className="mb-4 space-y-3">
                    <div className="flex justify-between text-gray-600">
                      <span>
                        Subtotal (
                        {items.reduce((sum, item) => sum + item.quantity, 0)}{" "}
                        items)
                      </span>
                      <span className="font-medium">
                        {isMember ? subtotal : regularSubtotal} NOK
                      </span>
                    </div>

                    {isMember && totalSavings > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span className="flex items-center gap-1">
                          <Tag className="h-4 w-4" />
                          Member Discount
                        </span>
                        <span className="font-medium">-{totalSavings} NOK</span>
                      </div>
                    )}
                  </div>

                  <Separator className="my-4" />

                  <div className="mb-6 flex justify-between">
                    <span className="font-bold text-gray-900 text-lg">
                      Total
                    </span>
                    <div className="text-right">
                      <div className="font-bold text-2xl text-[#3DA9E0]">
                        {subtotal} NOK
                      </div>
                    </div>
                  </div>

                  {isMember && totalSavings > 0 && (
                    <div className="mb-4 rounded-lg bg-green-50 p-3 text-center">
                      <p className="text-green-700 text-sm">
                        🎉 You&apos;re saving{" "}
                        <strong>{totalSavings} NOK</strong> with your
                        membership!
                      </p>
                    </div>
                  )}

                  <Button
                    className="mb-3 w-full bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 disabled:opacity-70"
                    disabled={isPending}
                    onClick={handleCheckout}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    {isPending ? "Processing..." : "Proceed to Checkout"}
                  </Button>

                  <Button
                    className="w-full border-[#3DA9E0]/20 text-[#001731] hover:bg-[#3DA9E0]/10"
                    onClick={() => router.push("/shop")}
                    variant="outline"
                  >
                    Continue Shopping
                  </Button>
                </Card>
              </motion.div>

              {/* Pickup Information */}
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 20 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="border-0 bg-blue-50 p-6 shadow-lg">
                  <div className="flex items-start gap-3">
                    <Package className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                    <div>
                      <h4 className="mb-2 font-semibold text-gray-900">
                        Campus Pickup
                      </h4>
                      <p className="mb-2 text-gray-700 text-sm">
                        All items will be available for pickup at the BISO
                        office at your campus.
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
