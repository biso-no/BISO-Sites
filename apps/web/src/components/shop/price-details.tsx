import { Separator } from "@repo/ui/components/ui/separator";
import { useTranslations } from "next-intl";
import { formatPrice } from "@/lib/types/webshop";

interface PriceDetailsProps {
  displayPrice: number;
  hasDiscount: boolean;
  isMember: boolean;
  memberPrice?: number | null;
  regularPrice: number;
  savings: number;
}

export function PriceDetails({
  isMember,
  regularPrice,
  memberPrice,
  displayPrice,
  hasDiscount,
  savings,
}: PriceDetailsProps) {
  const t = useTranslations("shop");

  if (!isMember && memberPrice && memberPrice < regularPrice) {
    return (
      <>
        <div className="flex justify-between text-muted-foreground">
          <span>{t("product.regularPrice")}</span>
          <span>{formatPrice(regularPrice)}</span>
        </div>
        <Separator />
        <div className="flex justify-between text-brand">
          <span>{t("product.memberPrice")}</span>
          <span>{formatPrice(memberPrice)}</span>
        </div>
        <Separator />
        <div className="flex justify-between text-green-600">
          <span>{t("product.memberSavings")}</span>
          <span>-{regularPrice - memberPrice} NOK</span>
        </div>
      </>
    );
  }

  if (hasDiscount) {
    return (
      <>
        <div className="flex justify-between text-muted-foreground line-through">
          <span>{t("product.regularPrice")}</span>
          <span>{formatPrice(regularPrice)}</span>
        </div>
        <div className="flex justify-between text-green-600">
          <span>{t("product.memberDiscount")}</span>
          <span>-{savings} NOK</span>
        </div>
        <Separator />
        <div className="flex justify-between font-semibold text-foreground">
          <span>{t("product.yourPrice")}</span>
          <span>{formatPrice(displayPrice)}</span>
        </div>
      </>
    );
  }

  return (
    <div className="flex justify-between font-semibold text-foreground">
      <span>{t("product.price")}</span>
      <span>{formatPrice(displayPrice)}</span>
    </div>
  );
}
