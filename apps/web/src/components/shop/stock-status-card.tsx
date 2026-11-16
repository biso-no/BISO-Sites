import { cn } from "@repo/ui/lib/utils";
import { Package } from "lucide-react";
import { useTranslations } from "next-intl";

interface StockStatusCardProps {
  availableStock: number | null;
  isLoading: boolean;
}

type StockStatus = "loading" | "outOfStock" | "inStock";

/** The state is in the words as well; the colour only repeats it. */
const TONE: Record<StockStatus, string> = {
  loading: "text-ink-muted",
  outOfStock: "text-danger",
  inStock: "text-success",
};

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
  return "inStock";
}

/**
 * The live stock line inside the buy card: whether the product can be bought
 * right now, net of other shoppers' cart holds. It says in stock or out of
 * stock and never how many — the shop does not publish its stock counts.
 */
export function StockStatusCard({
  isLoading,
  availableStock,
}: StockStatusCardProps) {
  const t = useTranslations("shop");
  const status = stockStatus(isLoading, availableStock);

  const label: Record<StockStatus, string> = {
    loading: t("card.checking"),
    outOfStock: t("card.outOfStock"),
    inStock: t("card.inStock"),
  };

  return (
    <div className="flex items-start gap-2">
      <Package
        aria-hidden="true"
        className={cn("mt-0.5 size-4 shrink-0", TONE[status])}
      />
      <p className={cn("type-body-sm font-semibold", TONE[status])}>
        {label[status]}
      </p>
    </div>
  );
}
