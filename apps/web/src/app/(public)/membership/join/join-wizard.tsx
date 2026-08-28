"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import { CAMPUS_INVOICE_NAMES } from "@repo/shared/utils/finago-membership-invoice";
import {
  type MembershipPlan,
  membershipPriceFormatter,
  POPULAR_MEMBERSHIP_DURATION,
} from "@repo/shared/utils/membership-plans";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Label } from "@repo/ui/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group";
import { cn } from "@repo/ui/lib/utils";
import { CreditCard, Loader2 } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { startMembershipCheckout } from "@/app/actions/membership-purchase";
import { MembershipPlanCard } from "@/components/membership/plan-card";
import { StepCard } from "@/components/shared/step-card";
import { NATIONAL_CAMPUS_ID } from "@/lib/campus-scope";

// National is not a study campus, so it is excluded from the invoice name
// catalog before it ever reaches the campus picker.

type PaymentProvider = "vipps" | "stripe";

interface JoinWizardProps {
  currentExpiry: string | null;
  defaultCampusId: string | null;
  plans: MembershipPlan[];
  providers: { stripe: boolean; vipps: boolean };
}

const campusOptions = Object.entries(CAMPUS_INVOICE_NAMES).filter(
  ([id]) => id !== NATIONAL_CAMPUS_ID
);

function PlanStep({
  currentExpiry,
  planId,
  plans,
  setPlanId,
}: {
  currentExpiry: string | null;
  planId: string | undefined;
  plans: MembershipPlan[];
  setPlanId: (value: string) => void;
}) {
  const t = useTranslations("membership.join.plan");
  return (
    <RadioGroup
      className="grid gap-4 sm:grid-cols-3"
      onValueChange={setPlanId}
      value={planId}
    >
      {plans.map((plan) => (
        <Label
          className="block cursor-pointer"
          htmlFor={`plan-${plan.id}`}
          key={plan.id}
        >
          <MembershipPlanCard
            footer={
              currentExpiry ? (
                <p className="text-muted-foreground text-xs">
                  {t("extends", { expiry: plan.expiryDate })}
                </p>
              ) : null
            }
            name={t(plan.duration)}
            popular={plan.duration === POPULAR_MEMBERSHIP_DURATION}
            popularLabel={t("popular")}
            price={plan.price}
            selected={planId === plan.id}
          >
            <RadioGroupItem id={`plan-${plan.id}`} value={plan.id} />
          </MembershipPlanCard>
        </Label>
      ))}
    </RadioGroup>
  );
}

function CampusStep({
  campusId,
  setCampusId,
}: {
  campusId: string | undefined;
  setCampusId: (value: string) => void;
}) {
  return (
    <RadioGroup
      className="grid gap-2.5 sm:grid-cols-2"
      onValueChange={setCampusId}
      value={campusId}
    >
      {campusOptions.map(([id, name]) => {
        const isSelected = campusId === id;
        return (
          <Label
            className={cn(
              "flex cursor-pointer items-center rounded-full border px-4 py-2.5 text-sm transition-colors",
              isSelected
                ? "border-brand bg-brand-muted font-medium text-brand-dark dark:text-brand"
                : "border-border hover:border-brand-border-strong"
            )}
            htmlFor={`campus-${id}`}
            key={id}
          >
            {name}
            <RadioGroupItem
              className="sr-only"
              id={`campus-${id}`}
              value={id}
            />
          </Label>
        );
      })}
    </RadioGroup>
  );
}

function PaymentSummary({
  campusName,
  selectedPlan,
}: {
  campusName: string | undefined;
  selectedPlan: MembershipPlan | undefined;
}) {
  const t = useTranslations("membership.join.pay");
  const tPlan = useTranslations("membership.join.plan");
  return (
    <div className="mb-6 overflow-hidden rounded-2xl bg-brand-dark text-white">
      <div className="h-1 w-full bg-brand-accent" />
      <div className="p-5">
        <div className="flex items-center justify-between gap-4">
          <span className="font-medium">{t("summary")}</span>
          <span className="font-bold text-2xl">
            {selectedPlan
              ? membershipPriceFormatter.format(selectedPlan.price)
              : "—"}
          </span>
        </div>
        {selectedPlan || campusName ? (
          <p className="mt-1 text-sm text-white/70">
            {selectedPlan ? tPlan(selectedPlan.duration) : null}
            {selectedPlan && campusName ? " · " : null}
            {campusName}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function VippsButton({
  asset,
  disabled,
  isPending,
  onClick,
}: {
  asset: string;
  disabled: boolean;
  isPending: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("membership.join.pay");
  return (
    <button
      className="relative h-14 w-full max-w-60 overflow-hidden rounded-full transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-60"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Image
        alt={t("vippsAlt")}
        className={cn(
          "object-contain transition-opacity",
          isPending && "opacity-40"
        )}
        fill
        sizes="240px"
        src={asset}
      />
      {isPending ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-white" />
        </span>
      ) : null}
    </button>
  );
}

function StripeButton({
  disabled,
  isPending,
  onClick,
}: {
  disabled: boolean;
  isPending: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("membership.join.pay");
  return (
    <button
      className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-sky-600 to-cyan-500 font-medium text-white shadow-sm transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-60"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {isPending ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <>
          <CreditCard className="h-5 w-5" />
          {t("stripe")}
        </>
      )}
    </button>
  );
}

function PaymentButtons({
  isPending,
  onPay,
  pendingProvider,
  providers,
  vippsAsset,
}: {
  isPending: boolean;
  onPay: (provider: PaymentProvider) => void;
  pendingProvider: PaymentProvider | null;
  providers: { stripe: boolean; vipps: boolean };
  vippsAsset: string;
}) {
  const t = useTranslations("membership.join.pay");

  if (!(providers.vipps || providers.stripe)) {
    return <p className="text-muted-foreground text-sm">{t("unavailable")}</p>;
  }

  return (
    <div className="grid items-center gap-4 sm:grid-cols-2">
      {providers.vipps ? (
        <VippsButton
          asset={vippsAsset}
          disabled={isPending}
          isPending={pendingProvider === "vipps"}
          onClick={() => onPay("vipps")}
        />
      ) : null}
      {providers.stripe ? (
        <StripeButton
          disabled={isPending}
          isPending={pendingProvider === "stripe"}
          onClick={() => onPay("stripe")}
        />
      ) : null}
    </div>
  );
}

/**
 * The purchase wizard for the `eligible` gate state. Plan and campus are
 * required selections (validated when a payment button is pressed); the
 * payment step renders direct-action Vipps/Stripe buttons instead of a
 * provider picker, derived from the `payments_vipps` / `payments_stripe`
 * feature flags passed down from the page — a disabled provider's button
 * never renders, and an all-disabled catalog degrades to an explanatory
 * message instead of a dead-end button.
 */
export function JoinWizard({
  currentExpiry,
  defaultCampusId,
  plans,
  providers,
}: JoinWizardProps) {
  const t = useTranslations("membership.join");
  const locale = useLocale();
  const [isPending, startSubmit] = useTransition();
  const [pendingProvider, setPendingProvider] =
    useState<PaymentProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | undefined>(plans[0]?.id);
  const [campusId, setCampusId] = useState<string | undefined>(
    defaultCampusId ?? undefined
  );

  const selectedPlan = plans.find((plan) => plan.id === planId);
  const campusName = campusId ? CAMPUS_INVOICE_NAMES[campusId] : undefined;
  const vippsAsset =
    locale === "en" ? "/images/vipps_en.svg" : "/images/vipps.svg";

  const handlePay = (provider: PaymentProvider) => {
    if (!campusId) {
      setError(t("errors.noCampus"));
      return;
    }
    if (!planId) {
      setError(t("errors.generic"));
      return;
    }

    setError(null);
    setPendingProvider(provider);
    trackEvent("membership_purchase_start", {
      campus: campusId,
      plan: planId,
      provider,
    });

    startSubmit(async () => {
      try {
        const result = await startMembershipCheckout({
          campusId,
          planId,
          provider,
        });
        if (result.success) {
          window.location.href = result.paymentUrl;
          return;
        }
        setPendingProvider(null);
        setError(result.error);
      } catch {
        setPendingProvider(null);
        setError(t("errors.generic"));
      }
    });
  };

  return (
    <div className="space-y-6">
      <StepCard step={1} title={t("plan.legend")}>
        <PlanStep
          currentExpiry={currentExpiry}
          planId={planId}
          plans={plans}
          setPlanId={setPlanId}
        />
      </StepCard>

      <StepCard step={2} title={t("campus.legend")}>
        <p className="mb-4 text-muted-foreground text-sm">{t("campus.help")}</p>
        <CampusStep campusId={campusId} setCampusId={setCampusId} />
      </StepCard>

      <StepCard step={3} title={t("pay.legend")}>
        <PaymentSummary campusName={campusName} selectedPlan={selectedPlan} />
        <PaymentButtons
          isPending={isPending}
          onPay={handlePay}
          pendingProvider={pendingProvider}
          providers={providers}
          vippsAsset={vippsAsset}
        />
        {error ? (
          <Alert className="mt-4" variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </StepCard>
    </div>
  );
}
