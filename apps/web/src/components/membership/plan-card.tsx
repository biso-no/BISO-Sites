import { membershipPriceFormatter } from "@repo/shared/utils/membership-plans";
import { cn } from "@repo/ui/lib/utils";
import { Check, Zap } from "lucide-react";
import type { ReactNode } from "react";

interface MembershipPlanCardProps {
  /** Bullet list of benefits, e.g. shown on the portal CTA but not the
   * denser purchase-flow card. */
  benefits?: string[];
  /** Rendered top-right of the card — typically a RadioGroupItem the caller
   * owns, so this component stays decoupled from any particular selection
   * mechanism (RadioGroup here, a plain onClick elsewhere). */
  children?: ReactNode;
  className?: string;
  /** Flow-specific line under the price, e.g. "Extends your membership to …" */
  footer?: ReactNode;
  name: string;
  popular?: boolean;
  popularLabel?: string;
  price: number;
  selected?: boolean;
}

/**
 * Presentational plan card shared between the /membership/join purchase flow
 * and the member portal's CTA section — the single source of truth for what
 * a membership plan looks like, fed by real `MembershipPlan` data in both
 * places instead of two independently hand-maintained visuals.
 */
export function MembershipPlanCard({
  children,
  className,
  benefits,
  footer,
  name,
  popular = false,
  popularLabel,
  price,
  selected = false,
}: MembershipPlanCardProps) {
  return (
    <div className={cn("relative h-full", className)}>
      {popular && popularLabel ? (
        <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-linear-to-r from-brand-gradient-from to-brand-gradient-to px-3 py-1 font-medium text-white text-xs shadow-md">
            <Zap className="h-3 w-3" />
            {popularLabel}
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          "flex h-full flex-col gap-3 rounded-2xl border-2 p-5 transition-all",
          selected
            ? "border-brand bg-brand-muted shadow-md"
            : "border-border hover:border-brand-border-strong",
          popular && "ring-1 ring-brand/30 ring-offset-2 ring-offset-background"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="font-medium text-foreground">{name}</span>
          {children}
        </div>

        <span className="font-bold text-3xl text-foreground">
          {membershipPriceFormatter.format(price)}
        </span>

        {benefits?.length ? (
          <ul className="mt-1 space-y-2">
            {benefits.map((benefit) => (
              <li className="flex items-center gap-2.5 text-sm" key={benefit}>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-gradient-from to-brand-gradient-to">
                  <Check className="h-3 w-3 text-white" />
                </span>
                <span className="text-muted-foreground">{benefit}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {footer}
      </div>
    </div>
  );
}
