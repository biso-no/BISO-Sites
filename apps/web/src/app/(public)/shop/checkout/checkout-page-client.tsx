"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import Link from "next/link";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { startCartCheckout } from "@/app/actions/orders";
import { cartSelectors, useCartStore } from "@/lib/stores/cart";

const NOK = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
});

export function CheckoutPageClient() {
  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => cartSelectors.subTotal(state));
  const clear = useCartStore((state) => state.clear);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    if (!(name.trim() && email.trim())) {
      toast.error("Name and email are required");
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          items: items.map((item) => ({
            productId: item.productId,
            slug: item.slug,
            quantity: item.quantity,
            variationId: item.variation?.id,
            customFields: item.customFieldResponses || {},
            customFieldLabels: item.customFields?.reduce<
              Record<string, string>
            >((acc, field) => {
              acc[field.id] = field.label;
              return acc;
            }, {}),
          })),
        };

        const result = await startCartCheckout(payload);
        if (!(result?.success && result.paymentUrl)) {
          toast.error(result?.error || "Could not start checkout");
          return;
        }

        clear();
        window.location.href = result.paymentUrl;
      } catch (error) {
        console.error("Checkout error", error);
        toast.error("Unable to start checkout. Please try again.");
      }
    });
  };

  if (items.length === 0) {
    return (
      <Card className="mx-auto max-w-2xl text-center">
        <CardHeader>
          <CardTitle>No items to checkout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>Your cart is empty. Add items from the shop to continue.</p>
          <Button asChild>
            <Link href="/shop">Back to shop</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form className="grid gap-6 md:grid-cols-[2fr_1fr]" onSubmit={handleSubmit}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Contact details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="checkout-name">
                Full name
              </label>
              <Input
                id="checkout-name"
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                required
                value={name}
              />
            </div>
            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="checkout-email">
                Email
              </label>
              <Input
                id="checkout-email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </div>
            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="checkout-phone">
                Phone (optional)
              </label>
              <Input
                id="checkout-phone"
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+47 9x xx xx xx"
                type="tel"
                value={phone}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" disabled={isPending} type="submit">
              {isPending ? "Starting checkout..." : "Pay with Vipps or card"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item) => (
              <div className="rounded-lg border p-4" key={item.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm">{item.title}</div>
                    {item.variation?.name ? (
                      <div className="text-muted-foreground text-xs">
                        {item.variation.name}
                      </div>
                    ) : null}
                    {item.customFields && item.customFields.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-muted-foreground text-xs">
                        {item.customFields.map((field) => (
                          <li key={field.id}>
                            <span className="font-medium text-foreground">
                              {field.label}:
                            </span>{" "}
                            {field.value}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="text-right text-sm">
                    <div>{NOK.format(item.unitPrice)}</div>
                    <div className="text-muted-foreground text-xs">
                      Qty {item.quantity}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{NOK.format(subtotal)}</span>
          </div>
          <p className="text-muted-foreground text-xs">
            Discounts and membership benefits will apply automatically if
            eligible. You will be redirected to Vipps to complete the payment.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button asChild className="w-full" variant="outline">
            <Link href="/shop/cart">Back to cart</Link>
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
