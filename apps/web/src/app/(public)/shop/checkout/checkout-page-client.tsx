"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@repo/ui/components/ui/alert";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  Smartphone,
  Store,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { createCartCheckoutSession } from "@/app/actions/orders";
import { type CartItem, useCart } from "@/lib/contexts/cart-context";

const NOK = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
});

export type PaymentProvider = "vipps" | "stripe";

interface CheckoutPageClientProps {
  enabledProviders: PaymentProvider[];
  initialEmail?: string;
  initialName?: string;
  isMember: boolean;
}

const providerMeta: Record<
  PaymentProvider,
  { Icon: typeof Smartphone; accent: string }
> = {
  vipps: { Icon: Smartphone, accent: "from-[#ff5b24] to-[#ff7d45]" },
  stripe: { Icon: CreditCard, accent: "from-sky-600 to-cyan-500" },
};

function buildCheckoutLineTitle(item: CartItem) {
  const optionSummary = item.selectedOptions
    ? Object.entries(item.selectedOptions)
        .map(([label, value]) => `${label}: ${value}`)
        .join(", ")
    : "";

  return optionSummary ? `${item.name} (${optionSummary})` : item.name;
}

function StepCard({
  step,
  title,
  badge,
  children,
}: {
  step: number;
  title: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-sm text-white">
            {step}
          </span>
          <h2 className="font-semibold text-foreground text-lg">{title}</h2>
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <Skeleton className="h-64 w-full rounded-3xl" />
        <Skeleton className="h-56 w-full rounded-3xl" />
        <Skeleton className="h-80 w-full rounded-3xl" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    </div>
  );
}

export function CheckoutPageClient({
  enabledProviders,
  isMember,
  initialEmail = "",
  initialName = "",
}: CheckoutPageClientProps) {
  const t = useTranslations("shop");
  const paymentsAvailable = enabledProviders.length > 0;
  const { items, isLoading, getSubtotal, getRegularSubtotal, getTotalSavings } =
    useCart();
  const subtotal = getSubtotal(isMember);
  const regularSubtotal = getRegularSubtotal();
  const savings = getTotalSavings(isMember);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const [provider, setProvider] = useState<PaymentProvider>(
    enabledProviders[0] ?? "vipps"
  );
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState("");
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const providerTitle = (value: PaymentProvider) =>
    value === "vipps"
      ? t("checkout.pay.vippsTitle")
      : t("checkout.pay.cardTitle");
  const providerDescription = (value: PaymentProvider) =>
    value === "vipps" ? t("checkout.pay.vipps") : t("checkout.pay.card");

  const fail = (message: string) => {
    setErrorMessage(message);
    toast.error(message);
  };

  const getSubmitLabel = () => {
    if (isPending) {
      return t("checkout.submit.starting");
    }
    if (!paymentsAvailable) {
      return t("checkout.submit.unavailable");
    }
    return t("checkout.submit.continueTo", {
      provider: providerTitle(provider),
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (items.length === 0) {
      fail(t("checkout.submit.emptyError"));
      return;
    }

    if (!paymentsAvailable) {
      fail(t("checkout.submit.unavailableError"));
      return;
    }

    if (!(name.trim() && email.trim())) {
      fail(t("checkout.submit.missingFields"));
      return;
    }

    trackEvent("checkout_start", { provider, itemCount, value: subtotal });

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
          fail(result?.error || t("checkout.submit.genericError"));
          return;
        }

        window.location.href = result.paymentUrl;
      } catch (error) {
        console.error("Checkout error", error);
        fail(
          error instanceof Error
            ? error.message
            : t("checkout.submit.genericError")
        );
      }
    });
  };

  if (isLoading) {
    return <CheckoutSkeleton />;
  }

  if (items.length === 0) {
    return (
      <Card className="mx-auto max-w-2xl overflow-hidden border-0 shadow-xl">
        <div className="bg-brand-dark p-8 text-white">
          <Badge className="border-0 bg-white/15 text-white">
            {t("checkout.eyebrow")}
          </Badge>
          <h2 className="mt-4 font-semibold text-3xl">
            {t("checkout.empty.title")}
          </h2>
          <p className="mt-2 max-w-md text-white/80">
            {t("checkout.empty.description")}
          </p>
        </div>
        <CardContent className="flex flex-col gap-3 p-8 sm:flex-row">
          <Button asChild>
            <Link href="/shop">{t("checkout.empty.browse")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/shop/cart">{t("checkout.empty.backToCart")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form
      className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]"
      onSubmit={handleSubmit}
    >
      <div className="space-y-6">
        <StepCard step={1} title={t("checkout.contact.step")}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="checkout-name">
                {t("checkout.contact.name")}
              </Label>
              <Input
                id="checkout-name"
                onChange={(event) => setName(event.target.value)}
                placeholder={t("checkout.contact.namePlaceholder")}
                required
                value={name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-email">
                {t("checkout.contact.email")}
              </Label>
              <Input
                id="checkout-email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("checkout.contact.emailPlaceholder")}
                required
                type="email"
                value={email}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-phone">
                {t("checkout.contact.phone")}
              </Label>
              <Input
                id="checkout-phone"
                onChange={(event) => setPhone(event.target.value)}
                placeholder={t("checkout.contact.phonePlaceholder")}
                type="tel"
                value={phone}
              />
            </div>
          </div>
        </StepCard>

        <StepCard step={2} title={t("checkout.pay.step")}>
          {paymentsAvailable ? (
            <RadioGroup
              className="grid gap-4 md:grid-cols-2"
              onValueChange={(value) => {
                const next = value as PaymentProvider;
                setProvider(next);
                trackEvent("checkout_provider_selected", { provider: next });
              }}
              value={provider}
            >
              {enabledProviders.map((value) => {
                const { Icon, accent } = providerMeta[value];
                const isSelected = provider === value;

                return (
                  <div
                    className={`relative block cursor-pointer overflow-hidden rounded-2xl border transition-all ${
                      isSelected
                        ? "border-brand shadow-md ring-1 ring-brand/30"
                        : "border-border hover:border-brand/40"
                    }`}
                    key={value}
                  >
                    <div className={`h-2 w-full bg-linear-to-r ${accent}`} />
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
                              {providerTitle(value)}
                            </div>
                            <div className="text-muted-foreground text-sm">
                              {providerDescription(value)}
                            </div>
                          </div>
                        </div>
                        {isSelected ? (
                          <div className="mt-4 flex items-center gap-2 text-brand text-sm">
                            <CheckCircle2 className="h-4 w-4" />
                            {t("checkout.pay.selected")}
                          </div>
                        ) : null}
                      </Label>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("checkout.pay.unavailable")}
            </p>
          )}
          <p className="mt-4 border-border/70 border-t pt-4 text-muted-foreground text-sm">
            {t("checkout.pay.footer")}
          </p>
        </StepCard>

        <StepCard
          badge={
            <Badge variant="secondary">
              {t("checkout.review.items", { count: itemCount })}
            </Badge>
          }
          step={3}
          title={t("checkout.review.step")}
        >
          <div className="space-y-4">
            {items.map((item) => {
              const unitPrice =
                isMember && item.memberPrice
                  ? item.memberPrice
                  : item.regularPrice;

              return (
                <div
                  className="rounded-2xl border border-border/60 bg-section/40 p-5"
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
                        {item.quantity} × {NOK.format(unitPrice)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </StepCard>
      </div>

      <div className="space-y-6">
        <div className="glass-panel p-6 accent-ring lg:sticky lg:top-24">
          <h2 className="mb-5 font-semibold text-foreground text-lg">
            {t("checkout.summary.title")}
          </h2>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {t("checkout.summary.items")}
              </span>
              <span>{itemCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {t("checkout.summary.subtotal")}
              </span>
              <span>{NOK.format(regularSubtotal)}</span>
            </div>
            {isMember && savings > 0 ? (
              <div className="flex items-center justify-between text-green-700">
                <span>{t("checkout.summary.memberSavings")}</span>
                <span>-{NOK.format(savings)}</span>
              </div>
            ) : null}
          </div>

          {/* Total — the one bold, yellow-accented moment on the page */}
          <div className="mt-5 overflow-hidden rounded-2xl bg-brand-dark text-white">
            <div className="h-1 w-full bg-brand-accent" />
            <div className="flex items-center justify-between p-5">
              <span className="font-medium">{t("checkout.summary.total")}</span>
              <span className="font-bold text-2xl">{NOK.format(subtotal)}</span>
            </div>
          </div>

          <div className="mt-5 space-y-3 rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              <div>
                <div className="font-medium">
                  {t("checkout.summary.secure")}
                </div>
                <p className="text-muted-foreground text-sm">
                  {t("checkout.summary.secureDesc", {
                    provider: providerTitle(provider),
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Store className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              <div>
                <div className="font-medium">
                  {t("checkout.summary.pickup")}
                </div>
                <p className="text-muted-foreground text-sm">
                  {t("checkout.summary.pickupDesc")}
                </p>
              </div>
            </div>
          </div>

          {errorMessage ? (
            <Alert className="mt-5" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t("checkout.submit.failed")}</AlertTitle>
              <AlertDescription className="break-words">
                {errorMessage}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="mt-5 flex flex-col gap-3">
            <Button
              className="w-full"
              disabled={isPending || !paymentsAvailable}
              type="submit"
            >
              {getSubmitLabel()}
            </Button>
            <Button asChild className="w-full" variant="outline">
              <Link href="/shop/cart">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("checkout.submit.backToCart")}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
