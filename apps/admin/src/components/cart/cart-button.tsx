"use client"

import Link from "next/link"
import { ShoppingCart } from "lucide-react"

import { Button } from "@repo/ui/components/ui/button"
import { useCartStore, cartSelectors } from "@/lib/stores/cart"

export function CartButton({ className }: { className?: string }) {
  const itemCount = useCartStore((state) => cartSelectors.itemCount(state))

  if (itemCount === 0) {
    return null
  }

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className={className}
    >
      <Link href="/shop/cart" className="relative flex items-center justify-center">
        <ShoppingCart className="h-5 w-5" />
        {itemCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
            {itemCount}
          </span>
        ) : null}
        <span className="sr-only">View cart</span>
      </Link>
    </Button>
  )
}
