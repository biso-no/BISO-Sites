import { cn } from "@repo/ui/lib/utils";
import { Package } from "lucide-react";
import { useTranslations } from "next-intl";

interface StockStatusCardProps {
  availableStock: number | null;
  isLoading: boolean;
  totalStock: number | null;
}

type StockStatus = "loading" | "outOfStock" | "lowStock" | "inStock";

/** The state is in the words as well; the colour only repeats it. */
const TONE: Record<StockStatus, string> = {
  loading: "text-ink-muted",
  outOfStock: "text-danger",
  lowStock: "text-warning",
  inStock: "text-success",
};

const LOW_STOCK_THRESHOLD = 10;

function stockStatus(
  isLoading: boolean,
  availableStock: number | null
): StockStatus {
  if (isLoading) {
    return "loading";
  }
  if (availableStock !== null && availableStock <= 0) {
    return "outOfStock";
  }
  if (availableStock !== null && availableStock <= LOW_STOCK_THRESHOLD) {
    return "lowStock";
  }
  return "inStock";
}

/**
 * The live stock line inside the buy card: what is buyable right now, net of
 * other shoppers' cart holds. A line rather than a card of its own — it
 * qualifies the price above it, it is not a separate thing to read.
 */
export function StockStatusCard({
  isLoading,
  availableStock,
  totalStock,
}: StockStatusCardProps) {
  const t = useTranslations("shop");
  const status = stockStatus(isLoading, availableStock);

  const label: Record<StockStatus, string> = {
    loading: t("card.checking"),
    outOfStock: t("card.outOfStock"),
    lowStock: t("card.onlyAvailable", { count: availableStock ?? 0 }),
    inStock: t("card.inStock"),
  };

  const reserved =
    !isLoading &&
    availableStock !== null &&
    (totalStock ?? 0) > 0 &&
    availableStock < (totalStock ?? 0)
      ? (totalStock ?? 0) - availableStock
      : 0;

  return (
    <div className="flex items-start gap-2">
      <Package
        aria-hidden="true"
        className={cn("mt-0.5 size-4 shrink-0", TONE[status])}
      />
      <div className="min-w-0">
        <p className={cn("type-body-sm font-semibold", TONE[status])}>
          {label[status]}
        </p>
        {!isLoading &&
        availableStock !== null &&
        availableStock > LOW_STOCK_THRESHOLD ? (
          <p className="type-body-sm text-ink-muted">
            {t("card.available", { count: availableStock })}
          </p>
        ) : null}
        {reserved > 0 ? (
          <p className="type-body-sm text-ink-muted">
            {t("card.reserved", { count: reserved })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
