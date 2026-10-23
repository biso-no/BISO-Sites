import { membershipPriceFormatter } from "@repo/shared/utils/membership-plans";
import { cn } from "@repo/ui/lib/utils";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Pill } from "@/components/ui/pill";

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
 *
 * Selection is a border in the action colour plus the radio the caller puts
 * in `children`, never colour alone.
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
    <div
      className={cn(
        "flex h-full flex-col gap-3 rounded-biso-md border-2 bg-surface p-5 transition-colors",
        selected ? "border-action" : "border-edge hover:border-ink-muted",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col items-start gap-2">
          {popular && popularLabel ? (
            <Pill tone="marker" uppercase>
              {popularLabel}
            </Pill>
          ) : null}
          <span className="type-heading-card text-ink">{name}</span>
        </div>
        {children}
      </div>

      <span className="type-display-sm text-ink">
        {membershipPriceFormatter.format(price)}
      </span>

      {benefits?.length ? (
        <ul className="mt-1 flex flex-col gap-2">
          {benefits.map((benefit) => (
            <li
              className="type-body-sm flex items-start gap-2.5 text-ink-muted"
              key={benefit}
            >
              <Check
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-ink-accent"
              />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {footer}
    </div>
  );
}
