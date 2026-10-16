"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import { Input } from "@repo/ui/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group";
import { cn } from "@repo/ui/lib/utils";
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
import {
  shopFieldClass,
  shopFieldLabelClass,
} from "@/components/shop/v2/form-styles";
import { Pill } from "@/components/ui/pill";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";
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

/**
 * Each provider is told apart by its name and description; the icon only
 * repeats it. The old per-provider gradient strips were the providers' brand
 * colours as raw hex — not this site's, and not a token.
 */
const providerIcon: Record<PaymentProvider, typeof Smartphone> = {
  vipps: Smartphone,
  stripe: CreditCard,
};

function buildCheckoutLineTitle(item: CartItem) {
  const optionSummary = item.selectedOptions
    ? Object.entries(item.selectedOptions)
        .map(([label, value]) => `${label}: ${value}`)
        .join(", ")
    : "";

  return optionSummary ? `${item.name} (${optionSummary})` : item.name;
}

/**
 * One numbered step of the checkout form. Local rather than the shared
 * `StepCard`, which still paints the pre-redesign palette.
 */
function CheckoutStep({
  aside,
  children,
  step,
  title,
}: {
  aside?: ReactNode;
  children: ReactNode;
  step: number;
  title: string;
}) {
  return (
    <section className="rounded-biso-md border border-edge bg-surface-raised p-6 sm:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="type-data flex size-8 shrink-0 items-center justify-center rounded-biso-pill bg-action text-action-ink"
          >
            {step}
          </span>
          <h2 className="type-heading-section text-ink">{title}</h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function SummaryRow({
  className = "text-ink",
  label,
  value,
}: {
  className?: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="type-body-sm text-ink-muted">{label}</dt>
      <dd className={`type-data ${className}`}>{value}</dd>
    </div>
  );
}

/** Still blocks where the steps and the summary will be — no pulse. */
function CheckoutSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <div className="space-y-6">
        <div className="h-64 rounded-biso-md bg-surface-sunken" />
        <div className="h-56 rounded-biso-md bg-surface-sunken" />
        <div className="h-80 rounded-biso-md bg-surface-sunken" />
      </div>
      <div className="h-96 rounded-biso-md bg-surface-sunken" />
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
            // Without these the buyer's answers stop at the cart and the order
            // line is stored with no record of what they filled in.
            customFields: item.customFields,
            customFieldLabels: item.customFieldLabels,
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
    // RD-031: this panel used to put white text on the legacy dark-brand
    // token, which measured 2.34:1 in the dark theme, where that token is a
    // light cyan. It is a plain bordered panel on the page surface now, so
    // every alias it uses flips with the theme.
    return (
      <div className="max-w-(--measure) rounded-biso-md border border-edge p-8 sm:p-10">
        <p className="type-label text-ink-accent">{t("checkout.eyebrow")}</p>
        <h2 className="type-display-sm mt-3 text-ink">
          {t("checkout.empty.title")}
        </h2>
        <p className="type-body mt-3 text-ink-muted">
          {t("checkout.empty.description")}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className={statusPanelPrimaryAction} href="/shop">
            {t("checkout.empty.browse")}
          </Link>
          <Link className={statusPanelSecondaryAction} href="/shop/cart">
            {t("checkout.empty.backToCart")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]"
      onSubmit={handleSubmit}
    >
      <div className="min-w-0 space-y-6">
        <CheckoutStep step={1} title={t("checkout.contact.step")}>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className={shopFieldLabelClass} htmlFor="checkout-name">
                {t("checkout.contact.name")}
              </label>
              <Input
                autoComplete="name"
                className={shopFieldClass}
                id="checkout-name"
                onChange={(event) => setName(event.target.value)}
                placeholder={t("checkout.contact.namePlaceholder")}
                required
                value={name}
              />
            </div>
            <div className="space-y-2">
              <label className={shopFieldLabelClass} htmlFor="checkout-email">
                {t("checkout.contact.email")}
              </label>
              <Input
                autoComplete="email"
                className={shopFieldClass}
                id="checkout-email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("checkout.contact.emailPlaceholder")}
                required
                type="email"
                value={email}
              />
            </div>
            <div className="space-y-2">
              <label className={shopFieldLabelClass} htmlFor="checkout-phone">
                {t("checkout.contact.phone")}
              </label>
              <Input
                autoComplete="tel"
                className={shopFieldClass}
                id="checkout-phone"
                onChange={(event) => setPhone(event.target.value)}
                placeholder={t("checkout.contact.phonePlaceholder")}
                type="tel"
                value={phone}
              />
            </div>
          </div>
        </CheckoutStep>

        <CheckoutStep step={2} title={t("checkout.pay.step")}>
          {paymentsAvailable ? (
            <RadioGroup
              aria-label={t("checkout.pay.step")}
              className="grid gap-4 md:grid-cols-2"
              onValueChange={(value) => {
                const next = value as PaymentProvider;
                setProvider(next);
                trackEvent("checkout_provider_selected", { provider: next });
              }}
              value={provider}
            >
              {enabledProviders.map((value) => {
                const Icon = providerIcon[value];
                const isSelected = provider === value;

                return (
                  <div
                    className={cn(
                      "relative rounded-biso-md border p-5 transition-colors",
                      isSelected
                        ? "border-action bg-action/5"
                        : "border-edge hover:border-ink-muted"
                    )}
                    key={value}
                  >
                    <div className="flex items-start gap-4">
                      <RadioGroupItem
                        className="mt-1 border-ink-muted text-action focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface data-[state=checked]:border-action [&_svg]:fill-action"
                        id={`provider-${value}`}
                        value={value}
                      />
                      <label
                        className="flex-1 cursor-pointer"
                        htmlFor={`provider-${value}`}
                      >
                        <span className="flex items-center gap-2">
                          <Icon
                            aria-hidden="true"
                            className="size-5 shrink-0 text-ink-accent"
                          />
                          <span className="type-heading-card text-ink">
                            {providerTitle(value)}
                          </span>
                        </span>
                        <span className="type-body-sm mt-1 block text-ink-muted">
                          {providerDescription(value)}
                        </span>
                        {isSelected ? (
                          <span className="type-body-sm mt-3 flex items-center gap-2 text-ink-accent">
                            <CheckCircle2
                              aria-hidden="true"
                              className="size-4"
                            />
                            {t("checkout.pay.selected")}
                          </span>
                        ) : null}
                      </label>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          ) : (
            <p className="type-body-sm text-ink-muted">
              {t("checkout.pay.unavailable")}
            </p>
          )}
          <p className="type-body-sm mt-5 border-edge border-t pt-4 text-ink-muted">
            {t("checkout.pay.footer")}
          </p>
        </CheckoutStep>

        <CheckoutStep
          aside={
            <Pill tone="neutral">
              {t("checkout.review.items", { count: itemCount })}
            </Pill>
          }
          step={3}
          title={t("checkout.review.step")}
        >
          <ul className="divide-y divide-edge">
            {items.map((item) => {
              const unitPrice =
                isMember && item.memberPrice
                  ? item.memberPrice
                  : item.regularPrice;

              return (
                <li
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                  key={item.id}
                >
                  <div className="min-w-0 space-y-2">
                    <p className="type-heading-card text-ink">{item.name}</p>
                    {item.category ? (
                      <p className="type-body-sm text-ink-muted">
                        {item.category}
                      </p>
                    ) : null}
                    {item.selectedOptions ? (
                      <ul className="flex flex-wrap gap-2">
                        {Object.entries(item.selectedOptions).map(
                          ([label, value]) => (
                            <li key={`${item.id}-${label}`}>
                              <Pill tone="neutral">
                                {label}: {value}
                              </Pill>
                            </li>
                          )
                        )}
                      </ul>
                    ) : null}
                  </div>

                  <div className="shrink-0 sm:text-end">
                    <p className="type-data text-ink">
                      {NOK.format(unitPrice * item.quantity)}
                    </p>
                    <p className="type-body-sm text-ink-muted">
                      {item.quantity} × {NOK.format(unitPrice)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </CheckoutStep>
      </div>

      <aside className="min-w-0">
        <div className="space-y-5 rounded-biso-md border border-edge bg-surface-raised p-6 lg:sticky lg:top-24">
          <h2 className="type-heading-section text-ink">
            {t("checkout.summary.title")}
          </h2>

          <dl>
            <SummaryRow label={t("checkout.summary.items")} value={itemCount} />
            <SummaryRow
              label={t("checkout.summary.subtotal")}
              value={NOK.format(regularSubtotal)}
            />
            {isMember && savings > 0 ? (
              <SummaryRow
                className="text-success"
                label={t("checkout.summary.memberSavings")}
                value={`-${NOK.format(savings)}`}
              />
            ) : null}
          </dl>

          <div className="flex items-baseline justify-between gap-4 border-edge border-t pt-4">
            <span className="type-heading-card text-ink">
              {t("checkout.summary.total")}
            </span>
            <span className="type-heading-section text-ink">
              {NOK.format(subtotal)}
            </span>
          </div>

          <div className="space-y-4 rounded-biso-sm bg-surface-sunken p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-ink-accent"
              />
              <div>
                <p className="type-body-sm font-semibold text-ink">
                  {t("checkout.summary.secure")}
                </p>
                <p className="type-body-sm text-ink-muted">
                  {t("checkout.summary.secureDesc", {
                    provider: providerTitle(provider),
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Store
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-ink-accent"
              />
              <div>
                <p className="type-body-sm font-semibold text-ink">
                  {t("checkout.summary.pickup")}
                </p>
                <p className="type-body-sm text-ink-muted">
                  {t("checkout.summary.pickupDesc")}
                </p>
              </div>
            </div>
          </div>

          {errorMessage ? (
            <div
              className="flex items-start gap-3 rounded-biso-sm border border-danger/30 bg-danger/10 p-4"
              role="alert"
            >
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-danger"
              />
              <div className="min-w-0">
                <p className="type-body-sm font-semibold text-ink">
                  {t("checkout.submit.failed")}
                </p>
                <p className="type-body-sm wrap-break-word text-ink">
                  {errorMessage}
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            <button
              className={cn(
                statusPanelPrimaryAction,
                "w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
              )}
              disabled={isPending || !paymentsAvailable}
              type="submit"
            >
              {getSubmitLabel()}
            </button>
            <Link
              className={cn(
                statusPanelSecondaryAction,
                "w-full justify-center"
              )}
              href="/shop/cart"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {t("checkout.submit.backToCart")}
            </Link>
          </div>
        </div>
      </aside>
    </form>
  );
}
