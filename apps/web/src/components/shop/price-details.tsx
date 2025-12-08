import { Separator } from "@repo/ui/components/ui/separator";
import { formatPrice } from "@/lib/types/webshop";

type PriceDetailsProps = {
  isMember: boolean;
  regularPrice: number;
  memberPrice?: number | null;
  displayPrice: number;
  hasDiscount: boolean;
  savings: number;
};

export function PriceDetails({
  isMember,
  regularPrice,
  memberPrice,
  displayPrice,
  hasDiscount,
  savings,
}: PriceDetailsProps) {
  if (!isMember && memberPrice && memberPrice < regularPrice) {
    return (
      <>
        <div className="flex justify-between text-muted-foreground">
          <span>Regular Price</span>
          <span>{formatPrice(regularPrice)}</span>
        </div>
        <Separator />
        <div className="flex justify-between text-[#3DA9E0]">
          <span>Member Price</span>
          <span>{formatPrice(memberPrice)}</span>
        </div>
        <Separator />
        <div className="flex justify-between text-green-600">
          <span>Member Savings</span>
          <span>-{regularPrice - memberPrice} NOK</span>
        </div>
      </>
    );
  }

  if (hasDiscount) {
    return (
      <>
        <div className="flex justify-between text-muted-foreground line-through">
          <span>Regular Price</span>
          <span>{formatPrice(regularPrice)}</span>
        </div>
        <div className="flex justify-between text-green-600">
          <span>Member Discount</span>
          <span>-{savings} NOK</span>
        </div>
        <Separator />
        <div className="flex justify-between font-semibold text-foreground">
          <span>Your Price</span>
          <span>{formatPrice(displayPrice)}</span>
        </div>
      </>
    );
  }

  return (
    <div className="flex justify-between font-semibold text-foreground">
      <span>Price</span>
      <span>{formatPrice(displayPrice)}</span>
    </div>
  );
}
