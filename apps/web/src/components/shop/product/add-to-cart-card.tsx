"use client";

import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { AlertCircle, CheckCircle2, ShoppingCart } from "lucide-react";
import {
  calculateSavings,
  formatPrice,
  getDisplayPrice,
} from "@/lib/types/webshop";
import { useProductPurchase } from "./product-purchase-provider";

export function AddToCartCard() {
  const {
    product,
    isMember,
    handleAddToCart,
    addedToCart,
    // availableStock, // We can use this if we want to show "Only X left" here, but stock status is separate
  } = useProductPurchase();

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
    <Card className="border-0 bg-linear-to-br from-brand-gradient-to to-brand-gradient-from p-6 shadow-lg">
      <div className="mb-6 text-center">
        {hasDiscount ? (
          <>
            <div className="mb-1 text-sm text-white/80 line-through">
              {formatPrice(productRef?.regular_price ?? 0)}
            </div>
            <div className="mb-2 font-bold text-4xl text-white">
              {formatPrice(displayPrice)}
            </div>
            <Badge className="border-0 bg-background/20 text-white">
              Save {savings} NOK
            </Badge>
          </>
        ) : (
          <div className="font-bold text-4xl text-white">
            {formatPrice(displayPrice)}
          </div>
        )}
      </div>

      {!isMember &&
        productRef?.member_price &&
        productRef?.member_price < (productRef?.regular_price ?? 0) && (
          <Alert className="mb-4 border-white/20 bg-background/10">
            <AlertCircle className="h-4 w-4 text-white" />
            <AlertDescription className="text-sm text-white">
              Become a BISO member to save{" "}
              {(productRef?.regular_price ?? 0) - productRef.member_price} NOK
              on this item!
            </AlertDescription>
          </Alert>
        )}

      <Button
        className="mb-3 w-full bg-background text-brand-dark hover:bg-background/90 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={productRef?.stock === 0}
        onClick={handleAddToCart}
      >
        <ShoppingCart className="mr-2 h-4 w-4" />
        {productRef?.stock === 0 ? "Out of Stock" : "Add to Cart"}
      </Button>

      {addedToCart && (
        <div className="fade-in slide-in-from-bottom-2 flex animate-in items-center justify-center gap-2 text-sm text-white duration-300">
          <CheckCircle2 className="h-4 w-4" />
          Added to cart!
        </div>
      )}
    </Card>
  );
}
