import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

interface PriceDetailsProps {
  displayPrice: number;
  hasDiscount: boolean;
  isMember: boolean;
  memberPrice?: number | null;
  regularPrice: number;
  savings: number;
}

/** One `<dt>`/`<dd>` pair; the caller supplies the `<dl>`. */
export function PriceRow({
  label,
  value,
  className = "text-ink",
}: {
  className?: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-edge border-b py-2 last:border-b-0">
      <dt className="type-body-sm text-ink-muted">{label}</dt>
      <dd className={`type-data ${className}`}>{value}</dd>
    </div>
  );
}

/**
 * The price breakdown under the buy button, as a definition list.
 *
 * `formatPrice` is not used: it returns the literal "Free" in every locale.
 */
export function PriceDetails({
  isMember,
  regularPrice,
  memberPrice,
  displayPrice,
  hasDiscount,
  savings,
}: PriceDetailsProps) {
  const t = useTranslations("shop");
  const price = (amount: number) =>
    amount > 0 ? `${amount} NOK` : t("card.free");

  if (!isMember && memberPrice && memberPrice < regularPrice) {
    return (
      <>
        <PriceRow
          label={t("product.regularPrice")}
          value={price(regularPrice)}
        />
        <PriceRow
          className="text-ink-accent"
          label={t("product.memberPrice")}
          value={price(memberPrice)}
        />
        <PriceRow
          className="text-success"
          label={t("product.memberSavings")}
          value={`-${regularPrice - memberPrice} NOK`}
        />
      </>
    );
  }

  if (hasDiscount) {
    return (
      <>
        <PriceRow
          className="text-ink-muted line-through"
          label={t("product.regularPrice")}
          value={price(regularPrice)}
        />
        <PriceRow
          className="text-success"
          label={t("product.memberDiscount")}
          value={`-${savings} NOK`}
        />
        <PriceRow label={t("product.yourPrice")} value={price(displayPrice)} />
      </>
    );
  }

  return <PriceRow label={t("product.price")} value={price(displayPrice)} />;
}
