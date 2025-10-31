"use client"

import Image from "next/image"
import Link from "next/link"
import { Trash2 } from "lucide-react"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/ui/card"
import { Button } from "@repo/ui/components/ui/button"
import { Input } from "@repo/ui/components/ui/input"
import { useCartStore, cartSelectors } from "@/lib/stores/cart"

const NOK = new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK" })

export function CartPageClient() {
  const items = useCartStore((state) => state.items)
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const removeItem = useCartStore((state) => state.removeItem)
  const clear = useCartStore((state) => state.clear)
  const subtotal = useCartStore((state) => cartSelectors.subTotal(state))
  const itemCount = useCartStore((state) => cartSelectors.itemCount(state))

  if (items.length === 0) {
    return (
      <Card className="mx-auto max-w-2xl text-center">
        <CardHeader>
          <CardTitle>Your cart is empty</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>Add items from the shop to get started.</p>
          <Button asChild>
            <Link href="/shop">Back to shop</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Items</h2>
          <Button variant="ghost" size="sm" onClick={clear}>
            Clear cart
          </Button>
        </div>
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
                {item.image ? (
                  <div className="relative h-24 w-24 overflow-hidden rounded-md border bg-muted">
                    <Image src={item.image} alt={item.title} fill className="object-cover" sizes="120px" />
                  </div>
                ) : (
                  <div className="h-24 w-24 rounded-md border border-dashed bg-muted" />
                )}
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold">{item.title}</h3>
                      {item.variation?.name ? (
                        <p className="text-sm text-muted-foreground">Variation: {item.variation.name}</p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {NOK.format(item.unitPrice)}
                      </div>
                      <div className="text-xs text-muted-foreground">per unit</div>
                    </div>
                  </div>
                  {item.customFields && item.customFields.length > 0 ? (
                    <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                      <ul className="space-y-1">
                        {item.customFields.map((field) => (
                          <li key={field.id}>
                            <span className="font-medium text-foreground">{field.label}:</span>{" "}
                            {field.value}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label htmlFor={`qty-${item.id}`} className="text-sm text-muted-foreground">
                        Qty
                      </label>
                      <Input
                        id={`qty-${item.id}`}
                        type="number"
                        min={1}
                        value={item.quantity}
                        className="h-9 w-20"
                        onChange={(event) => updateQuantity(item.id, Number(event.target.value))}
                        disabled={item.maxPerUser === 1}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-2 text-destructive"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                    {item.maxPerOrder ? (
                      <span className="text-xs text-muted-foreground">
                        Max {item.maxPerOrder} per order
                      </span>
                    ) : null}
                    {item.maxPerUser === 1 ? (
                      <span className="text-xs text-muted-foreground">One per customer</span>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Order summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span>Items</span>
            <span>{itemCount}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Subtotal</span>
            <span>{NOK.format(subtotal)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Final price may change if discounts apply or options are updated at checkout.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/shop/checkout">Proceed to checkout</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/shop">Continue shopping</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
