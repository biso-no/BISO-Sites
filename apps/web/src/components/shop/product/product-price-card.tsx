import type { ContentTranslations } from "@repo/api/types/appwrite";
import { Card } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { calculateSavings, getDisplayPrice } from "@/lib/types/webshop";
import { PriceDetails } from "../price-details";

type ProductPriceCardProps = {
  product: ContentTranslations;
  isMember: boolean;
};

export function ProductPriceCard({ product, isMember }: ProductPriceCardProps) {
  const productRef = product.product_ref;
  const displayPrice = getDisplayPrice(
    productRef?.regular_price ?? 0,
    productRef?.member_price,
    isMember
  );
  const hasDiscount =
    isMember &&
    productRef?.member_price &&
    productRef?.member_price < (productRef?.regular_price ?? 0);
  const savings = calculateSavings(
    productRef?.regular_price ?? 0,
    productRef?.member_price
  );

  return (
    <Card className="border-0 p-6 shadow-lg">
      <h3 className="mb-4 font-bold text-gray-900">Price Details</h3>
      <div className="space-y-3">
        <PriceDetails
          displayPrice={displayPrice}
          hasDiscount={!!hasDiscount}
          isMember={isMember}
          memberPrice={productRef?.member_price}
          regularPrice={productRef?.regular_price ?? 0}
          savings={savings}
        />
        <Separator />
        <div className="flex justify-between text-gray-600 text-sm">
          <span>Shipping</span>
          <span className="font-medium text-green-600">
            Free (Campus Pickup)
          </span>
        </div>
        <div className="flex justify-between text-gray-600 text-sm">
          <span>Tax</span>
          <span>Included</span>
        </div>
      </div>
    </Card>
  );
}
