"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  Smartphone,
  Store,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { createCartCheckoutSession } from "@/app/actions/orders";
import { type CartItem, useCart } from "@/lib/contexts/cart-context";

const NOK = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
});

type PaymentProvider = "vipps" | "stripe";

interface CheckoutPageClientProps {
  isMember: boolean;
}

const providerCopy: Record<
  PaymentProvider,
  {
    title: string;
    description: string;
    Icon: typeof Smartphone;
    accent: string;
  }
> = {
  vipps: {
    title: "Vipps",
    description: "Fast checkout with Vipps and MobilePay.",
    Icon: Smartphone,
    accent: "from-[#ff5b24] to-[#ff7d45]",
  },
  stripe: {
    title: "Card",
    description: "Pay securely with Visa, Mastercard, and other cards.",
    Icon: CreditCard,
    accent: "from-sky-600 to-cyan-500",
  },
};

function buildCheckoutLineTitle(item: CartItem) {
  const optionSummary = item.selectedOptions
    ? Object.entries(item.selectedOptions)
        .map(([label, value]) => `${label}: ${value}`)
        .join(", ")
    : "";

  return optionSummary ? `${item.name} (${optionSummary})` : item.name;
}

function CheckoutSkeleton() {
  return (
    <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

export function CheckoutPageClient({ isMember }: CheckoutPageClientProps) {
  const { items, isLoading, getSubtotal, getRegularSubtotal, getTotalSavings } =
    useCart();
  const subtotal = getSubtotal(isMember);
  const regularSubtotal = getRegularSubtotal();
  const savings = getTotalSavings(isMember);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const [provider, setProvider] = useState<PaymentProvider>("vipps");
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
        const result = await createCartCheckoutSession({
          provider,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          items: items.map((item) => ({
            productId: item.productId,
            slug: item.slug,
            quantity: item.quantity,
            title: buildCheckoutLineTitle(item),
          })),
        });

        if (!(result?.success && result.paymentUrl)) {
          toast.error(result?.error || "Could not start checkout");
          return;
        }

        window.location.href = result.paymentUrl;
      } catch (error) {
        console.error("Checkout error", error);
        toast.error("Unable to start checkout. Please try again.");
      }
    });
  };

  if (isLoading) {
    return <CheckoutSkeleton />;
  }

  if (items.length === 0) {
    return (
      <Card className="mx-auto max-w-3xl overflow-hidden border-0 bg-white shadow-xl">
        <div className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to p-8 text-white">
          <Badge className="border-0 bg-white/15 text-white">Checkout</Badge>
          <h2 className="mt-4 font-semibold text-3xl">Your cart is empty</h2>
          <p className="mt-2 max-w-xl text-white/80">
            Add products from the shop before heading to checkout.
          </p>
        </div>
        <CardContent className="flex flex-col gap-4 p-8 sm:flex-row">
          <Button asChild className="sm:w-auto">
            <Link href="/shop">Browse the shop</Link>
          </Button>
          <Button asChild className="sm:w-auto" variant="outline">
            <Link href="/shop/cart">Back to cart</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form
      className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]"
      onSubmit={handleSubmit}
    >
      <div className="space-y-6">
        <Card className="overflow-hidden border-0 shadow-xl">
          <div className="bg-linear-to-br from-brand-gradient-from via-brand-gradient-to to-cyan-500 p-8 text-white">
            <Badge className="border-0 bg-white/15 text-white">
              Contact details
            </Badge>
            <h2 className="mt-4 font-semibold text-3xl">
              Finish your order in one step
            </h2>
            <p className="mt-2 max-w-2xl text-white/80">
              Review the order, choose a payment provider, and we will send you
              straight to the secure checkout.
            </p>
          </div>
          <CardContent className="grid gap-4 p-8 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="checkout-name">Full name</Label>
              <Input
                id="checkout-name"
                onChange={(event) => setName(event.target.value)}
                placeholder="Your full name"
                required
                value={name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-email">Email</Label>
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
              <Label htmlFor="checkout-phone">Phone</Label>
              <Input
                id="checkout-phone"
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+47 9x xx xx xx"
                type="tel"
                value={phone}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl">
          <CardHeader>
            <CardTitle>Choose how to pay</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              className="grid gap-4 md:grid-cols-2"
              onValueChange={(value) => setProvider(value as PaymentProvider)}
              value={provider}
            >
              {(
                Object.entries(providerCopy) as [
                  PaymentProvider,
                  (typeof providerCopy)[PaymentProvider],
                ][]
              ).map(([value, config]) => {
                const Icon = config.Icon;
                const isSelected = provider === value;

                return (
                  <div
                    className={`relative block cursor-pointer overflow-hidden rounded-2xl border transition-all ${
                      isSelected
                        ? "border-brand shadow-md"
                        : "border-border hover:border-brand/40"
                    }`}
                    key={value}
                  >
                    <div
                      className={`h-2 w-full bg-linear-to-r ${config.accent}`}
                    />
                    <div className="flex items-start gap-4 p-5">
                      <RadioGroupItem
                        className="mt-1"
                        id={`provider-${value}`}
                        value={value}
                      />
                      <Label
                        className="flex-1 cursor-pointer"
                        htmlFor={`provider-${value}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="rounded-full bg-section p-2">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-medium text-base">
                              {config.title}
                            </div>
                            <div className="text-muted-foreground text-sm">
                              {config.description}
                            </div>
                          </div>
                        </div>
                        {isSelected ? (
                          <div className="mt-4 flex items-center gap-2 text-brand text-sm">
                            <CheckCircle2 className="h-4 w-4" />
                            Selected for checkout
                          </div>
                        ) : null}
                      </Label>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          </CardContent>
          <CardFooter className="border-t bg-section/40 px-6 py-4 text-muted-foreground text-sm">
            The payment page opens in the selected provider&apos;s secure hosted
            checkout.
          </CardFooter>
        </Card>

        <Card className="border-0 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Order review</CardTitle>
            <Badge variant="secondary">{itemCount} item(s)</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item) => {
              const unitPrice =
                isMember && item.memberPrice
                  ? item.memberPrice
                  : item.regularPrice;

              return (
                <div
                  className="rounded-2xl border border-border/70 bg-white p-5"
                  key={item.id}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="font-medium text-base">{item.name}</div>
                      {item.category ? (
                        <div className="text-muted-foreground text-sm">
                          {item.category}
                        </div>
                      ) : null}
                      {item.selectedOptions ? (
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(item.selectedOptions).map(
                            ([label, value]) => (
                              <Badge
                                className="border border-border bg-section text-foreground"
                                key={`${item.id}-${label}`}
                                variant="outline"
                              >
                                {label}: {value}
                              </Badge>
                            )
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="text-left sm:text-right">
                      <div className="font-medium text-base">
                        {NOK.format(unitPrice * item.quantity)}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {item.quantity} x {NOK.format(unitPrice)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="border-0 shadow-xl xl:sticky xl:top-24">
          <CardHeader>
            <CardTitle>Order summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl bg-section p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Items</span>
                <span>{itemCount}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{NOK.format(regularSubtotal)}</span>
              </div>
              {isMember && savings > 0 ? (
                <div className="mt-3 flex items-center justify-between text-green-700 text-sm">
                  <span>Member savings</span>
                  <span>-{NOK.format(savings)}</span>
                </div>
              ) : null}
              <div className="mt-4 border-border/70 border-t pt-4">
                <div className="flex items-center justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>{NOK.format(subtotal)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/70 bg-white p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-brand" />
                <div>
                  <div className="font-medium">Secure checkout</div>
                  <p className="text-muted-foreground text-sm">
                    Payment is completed in {providerCopy[provider].title}
                    &apos;s hosted checkout, not on this page.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Store className="mt-0.5 h-5 w-5 text-brand" />
                <div>
                  <div className="font-medium">Campus pickup</div>
                  <p className="text-muted-foreground text-sm">
                    We will prepare the order for pickup at your local BISO
                    office.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button className="w-full" disabled={isPending} type="submit">
              {isPending
                ? "Starting checkout..."
                : `Continue to ${providerCopy[provider].title}`}
            </Button>
            <Button asChild className="w-full" variant="outline">
              <Link href="/shop/cart">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to cart
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </form>
  );
}
