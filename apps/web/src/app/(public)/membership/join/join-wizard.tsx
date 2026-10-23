"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import { CAMPUS_INVOICE_NAMES } from "@repo/shared/utils/finago-membership-invoice";
import {
  type MembershipDuration,
  type MembershipPlan,
  membershipPriceFormatter,
  POPULAR_MEMBERSHIP_DURATION,
} from "@repo/shared/utils/membership-plans";
import { Label } from "@repo/ui/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group";
import { cn } from "@repo/ui/lib/utils";
import { Check, CreditCard, Loader2 } from "lucide-react";
import Image from "next/image";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { startMembershipCheckout } from "@/app/actions/membership-purchase";
import { MembershipPlanCard } from "@/components/membership/plan-card";
import { StepCard } from "@/components/shared/step-card";
import { statusPanelPrimaryAction } from "@/components/ui/status-panel";
import { NATIONAL_CAMPUS_ID } from "@/lib/campus-scope";
import {
  cardPlan,
  groupOffersByDuration,
  type MembershipOfferGroup,
} from "@/lib/membership-offer-groups";

// National is not a study campus, so it is excluded from the invoice name
// catalog before it ever reaches the campus picker.

type PaymentProvider = "vipps" | "stripe";

interface JoinWizardProps {
  currentExpiry: string | null;
  defaultCampusId: string | null;
  plans: MembershipPlan[];
  providers: { stripe: boolean; vipps: boolean };
}

/** The shared radio in the action colour, with a focus ring that shows. */
const radioClass =
  "border-edge text-action focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface [&_svg]:fill-current";

const campusOptions = Object.entries(CAMPUS_INVOICE_NAMES).filter(
  ([id]) => id !== NATIONAL_CAMPUS_ID
);

function PlanStep({
  currentExpiry,
  duration,
  groups,
  selectDuration,
  useNext,
}: {
  currentExpiry: string | null;
  duration: MembershipDuration | undefined;
  groups: MembershipOfferGroup[];
  selectDuration: (value: MembershipDuration) => void;
  useNext: boolean;
}) {
  const t = useTranslations("membership.join.plan");
  const format = useFormatter();
  return (
    <RadioGroup
      className="grid gap-4 sm:grid-cols-3"
      onValueChange={(value) => selectDuration(value as MembershipDuration)}
      value={duration}
    >
      {groups.map((group) => {
        const shown = cardPlan(group, duration, useNext);
        if (!shown) {
          return null;
        }
        return (
          <Label
            className="block cursor-pointer"
            htmlFor={`plan-${group.duration}`}
            key={group.duration}
          >
            <MembershipPlanCard
              footer={
                currentExpiry ? (
                  <p className="type-body-sm text-ink-muted">
                    {t("extends", {
                      expiry: format.dateTime(new Date(shown.expiryDate), {
                        dateStyle: "long",
                      }),
                    })}
                  </p>
                ) : null
              }
              name={t(group.duration)}
              popular={group.duration === POPULAR_MEMBERSHIP_DURATION}
              popularLabel={t("popular")}
              price={shown.price}
              selected={duration === group.duration}
            >
              <RadioGroupItem
                className={radioClass}
                id={`plan-${group.duration}`}
                value={group.duration}
              />
            </MembershipPlanCard>
          </Label>
        );
      })}
    </RadioGroup>
  );
}

/**
 * Shown in the last month of a season (June/December) when the chosen
 * duration has both this season's and next season's plan on offer.
 */
function SeasonChoice({
  group,
  setUseNext,
  useNext,
}: {
  group: Required<MembershipOfferGroup>;
  setUseNext: (value: boolean) => void;
  useNext: boolean;
}) {
  const t = useTranslations("membership.join.plan");
  const format = useFormatter();
  const date = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: "long" });
  return (
    <div className="mt-6 flex flex-col gap-3 rounded-biso-md border border-edge p-4">
      <p className="type-body-sm font-semibold text-ink">
        {t("endsSoon", { end: date(group.current.expiryDate) })}
      </p>
      <RadioGroup
        className="grid gap-2"
        onValueChange={(value) => setUseNext(value === "next")}
        value={useNext ? "next" : "current"}
      >
        <Label
          className="type-body-sm flex cursor-pointer items-center gap-2 font-normal text-ink"
          htmlFor="offer-current"
        >
          <RadioGroupItem
            className={radioClass}
            id="offer-current"
            value="current"
          />
          {t("buyThisSeason", { end: date(group.current.expiryDate) })}
        </Label>
        <Label
          className="type-body-sm flex cursor-pointer items-center gap-2 font-normal text-ink"
          htmlFor="offer-next"
        >
          <RadioGroupItem className={radioClass} id="offer-next" value="next" />
          {t("buyNextSeason", {
            end: date(group.next.expiryDate),
            start: date(group.next.startDate),
          })}
        </Label>
      </RadioGroup>
    </div>
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
              "type-body-sm flex cursor-pointer items-center gap-2 rounded-biso-pill border-2 px-4 py-2.5 transition-colors",
              // The radio itself is visually hidden, so the chip carries its
              // keyboard focus.
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus-ring has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-offset-2",
              isSelected
                ? "border-action bg-action/10 font-semibold text-ink"
                : "border-edge font-normal text-ink hover:border-ink-muted"
            )}
            htmlFor={`campus-${id}`}
            key={id}
          >
            {isSelected ? (
              <Check
                aria-hidden="true"
                className="size-4 shrink-0 text-ink-accent"
              />
            ) : null}
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
    <div
      className="mb-6 overflow-hidden rounded-biso-md bg-surface text-ink"
      data-surface="deep"
    >
      <div aria-hidden="true" className="h-1 w-full bg-marker" />
      <div className="p-5">
        <div className="flex items-center justify-between gap-4">
          <span className="type-body-sm font-semibold">{t("summary")}</span>
          <span className="type-display-sm">
            {selectedPlan
              ? membershipPriceFormatter.format(selectedPlan.price)
              : "—"}
          </span>
        </div>
        {selectedPlan || campusName ? (
          <p className="type-body-sm mt-1 text-ink-muted">
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
      className="relative h-14 w-full max-w-60 overflow-hidden rounded-biso-pill transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60"
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
          <Loader2
            aria-hidden="true"
            className="size-5 animate-spin text-white"
          />
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
      className={cn(
        statusPanelPrimaryAction,
        "h-14 w-full justify-center disabled:pointer-events-none disabled:opacity-60"
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {isPending ? (
        <Loader2 aria-hidden="true" className="size-5 animate-spin" />
      ) : (
        <>
          <CreditCard aria-hidden="true" className="size-5" />
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
    return <p className="type-body-sm text-ink-muted">{t("unavailable")}</p>;
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
  const groups = groupOffersByDuration(plans);
  const [duration, setDuration] = useState<MembershipDuration | undefined>(
    groups[0]?.duration
  );
  // "Start next semester instead" — only offered when a group has both plans.
  const [useNext, setUseNext] = useState(false);
  const selectDuration = (value: MembershipDuration) => {
    setDuration(value);
    setUseNext(false);
  };
  const [campusId, setCampusId] = useState<string | undefined>(
    defaultCampusId ?? undefined
  );

  const selectedGroup = groups.find((group) => group.duration === duration);
  const selectedPlan =
    useNext || !selectedGroup?.current
      ? selectedGroup?.next
      : selectedGroup.current;
  const planId = selectedPlan?.id;
  const seasonChoice =
    selectedGroup?.current && selectedGroup.next
      ? (selectedGroup as Required<MembershipOfferGroup>)
      : null;
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
    <div className="flex flex-col gap-6">
      <StepCard step={1} title={t("plan.legend")}>
        <PlanStep
          currentExpiry={currentExpiry}
          duration={duration}
          groups={groups}
          selectDuration={selectDuration}
          useNext={useNext}
        />
        {seasonChoice ? (
          <SeasonChoice
            group={seasonChoice}
            setUseNext={setUseNext}
            useNext={useNext}
          />
        ) : null}
      </StepCard>

      <StepCard step={2} title={t("campus.legend")}>
        <p className="type-body-sm mb-4 text-ink-muted">{t("campus.help")}</p>
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
          <p
            className="type-body-sm mt-4 rounded-biso-md border border-danger/40 bg-danger/5 p-4 text-danger"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </StepCard>
    </div>
  );
}
