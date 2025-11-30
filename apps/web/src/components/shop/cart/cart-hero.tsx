"use client";

import { ImageWithFallback } from "@repo/ui/components/image";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/lib/contexts/cart-context";

export function CartHero() {
  const { getItemCount } = useCart();
  const itemCount = getItemCount();

  return (
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
          <Link
            className="absolute top-8 left-8 flex items-center gap-2 text-white transition-colors hover:text-[#3DA9E0]"
            href="/shop"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Shop
          </Link>

          <div className="fade-in slide-in-from-bottom-4 animate-in duration-700">
            <div className="mb-4 flex items-center justify-center gap-2">
              <ShoppingCart className="h-12 w-12 text-[#3DA9E0]" />
            </div>
            <h1 className="mb-4 font-bold text-4xl text-white md:text-5xl">
              Your Cart
            </h1>
            <p className="text-lg text-white/90">
              {itemCount} {itemCount === 1 ? "item" : "items"} ready for pickup
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
