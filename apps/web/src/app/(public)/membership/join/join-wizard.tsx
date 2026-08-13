"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import { CAMPUS_INVOICE_NAMES } from "@repo/shared/utils/finago-membership-invoice";
import type { MembershipPlan } from "@repo/shared/utils/membership-plans";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Label } from "@repo/ui/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group";
import { useTranslations } from "next-intl";
import { type FormEvent, useMemo, useState, useTransition } from "react";
import { startMembershipCheckout } from "@/app/actions/membership-purchase";

// "5" is National — not a study campus, so it is excluded from the invoice
// name catalog before it ever reaches the campus picker.
const NATIONAL_CAMPUS_ID = "5";

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

/**
 * The purchase wizard for the `eligible` gate state. Plan and campus are
 * required selections (validated on submit); the payment provider list is
 * derived entirely from the `payments_vipps` / `payments_stripe` feature
 * flags passed down from the page, so a disabled provider never renders as a
 * dead button and an all-disabled catalog degrades to an explanatory message
 * instead of a broken form.
 */
export function JoinWizard({
  currentExpiry,
  defaultCampusId,
  plans,
  providers,
}: JoinWizardProps) {
  const t = useTranslations("membership.join");
  const [isPending, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | undefined>(plans[0]?.id);
  const [campusId, setCampusId] = useState<string | undefined>(
    defaultCampusId ?? undefined
  );

  const providerOptions = useMemo<PaymentProvider[]>(() => {
    const options: PaymentProvider[] = [];
    if (providers.vipps) {
      options.push("vipps");
    }
    if (providers.stripe) {
      options.push("stripe");
    }
    return options;
  }, [providers.stripe, providers.vipps]);

  const [provider, setProvider] = useState<PaymentProvider | undefined>(
    providerOptions[0]
  );
  const paymentAvailable = providerOptions.length > 0;
  const selectedPlan = plans.find((plan) => plan.id === planId);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!planId) {
      setError(t("errors.noPlan"));
      return;
    }
    if (!campusId) {
      setError(t("errors.noCampus"));
      return;
    }
    if (!provider) {
      setError(t("errors.generic"));
      return;
    }

    setError(null);
    trackEvent("membership_purchase_start", {
      plan: planId,
      campus: campusId,
      provider,
    });

    startSubmit(async () => {
      const result = await startMembershipCheckout({
        campusId,
        planId,
        provider,
      });
      if (result.success) {
        window.location.href = result.paymentUrl;
        return;
      }
      setError(result.error);
    });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="mb-8 text-center">
        <h1 className="font-bold text-3xl text-foreground">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card className="p-6 sm:p-8">
        <form className="space-y-8" onSubmit={handleSubmit}>
          <fieldset className="space-y-3">
            <legend className="font-semibold text-foreground text-sm">
              {t("plan.legend")}
            </legend>
            <RadioGroup
              className="grid gap-3"
              onValueChange={setPlanId}
              value={planId}
            >
              {plans.map((plan) => (
                <div
                  className="flex items-start gap-3 rounded-lg border border-border p-4"
                  key={plan.id}
                >
                  <RadioGroupItem
                    className="mt-1"
                    id={`plan-${plan.id}`}
                    value={plan.id}
                  />
                  <Label
                    className="flex-1 cursor-pointer"
                    htmlFor={`plan-${plan.id}`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium text-foreground">
                        {t(`plan.${plan.duration}`)}
                      </span>
                      <span className="font-semibold text-foreground">
                        {t("plan.price", { price: plan.price })}
                      </span>
                    </div>
                    {currentExpiry ? (
                      <p className="mt-1 text-muted-foreground text-sm">
                        {t("plan.extends", { expiry: plan.expiryDate })}
                      </p>
                    ) : null}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="font-semibold text-foreground text-sm">
              {t("campus.legend")}
            </legend>
            <p className="text-muted-foreground text-sm">{t("campus.help")}</p>
            <RadioGroup
              className="grid gap-3 sm:grid-cols-2"
              onValueChange={setCampusId}
              value={campusId}
            >
              {campusOptions.map(([id, name]) => (
                <div
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                  key={id}
                >
                  <RadioGroupItem id={`campus-${id}`} value={id} />
                  <Label className="cursor-pointer" htmlFor={`campus-${id}`}>
                    {name}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="font-semibold text-foreground text-sm">
              {t("pay.legend")}
            </legend>
            {paymentAvailable ? (
              <RadioGroup
                className="grid gap-3 sm:grid-cols-2"
                onValueChange={(value) => setProvider(value as PaymentProvider)}
                value={provider}
              >
                {providerOptions.map((option) => (
                  <div
                    className="flex items-center gap-3 rounded-lg border border-border p-3"
                    key={option}
                  >
                    <RadioGroupItem id={`pay-${option}`} value={option} />
                    <Label className="cursor-pointer" htmlFor={`pay-${option}`}>
                      {t(`pay.${option}`)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <p className="text-muted-foreground text-sm">
                {t("pay.unavailable")}
              </p>
            )}
          </fieldset>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            className="w-full"
            disabled={isPending || !paymentAvailable}
            size="lg"
            type="submit"
          >
            {isPending
              ? t("pay.working")
              : t("pay.submit", { price: selectedPlan?.price ?? 0 })}
          </Button>
        </form>
      </Card>
    </div>
  );
}
