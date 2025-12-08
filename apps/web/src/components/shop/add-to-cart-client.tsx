"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { AlertCircle, CheckCircle2, ShoppingCart } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { formatPrice } from "@/lib/types/webshop";
import { PriceDetails } from "./price-details";
import { StockStatusCard } from "./stock-status-card";
import { useProductActions } from "./use-product-actions";

type AddToCartClientProps = {
  product: ContentTranslations;
  isMember: boolean;
  userId: string | null;
  regularPrice: number;
  memberPrice?: number | null;
  displayPrice: number;
  hasDiscount: boolean;
  savings: number;
  stock: number | null;
};

// This component encapsulates all interactive sidebar elements
export function AddToCartClient({
  product,
  isMember,
  userId,
  regularPrice,
  memberPrice,
  displayPrice,
  hasDiscount,
  savings,
  stock,
}: AddToCartClientProps) {
  // Option state would ideally be managed by a global state/context or the parent server component's useFormState
  // For simplicity, we use the bare minimum here.
  const [selectedOptions] = useState<Record<string, string>>({});
  const [availableStock] = useState<number | null>(stock); // Stock logic is simplified for this refactor
  const [isLoadingStock] = useState(false);

  const { handleAddToCart: addToCartAction, addedToCart } = useProductActions(
    product,
    userId
  );

  const handleAddToCart = async () => {
    // Need to get selectedOptions from somewhere (e.g., context/parent state)
    await addToCartAction(selectedOptions);
  };

  return (
    <>
      {/* Stock Status */}
      {stock !== null && (
        <StockStatusCard
          availableStock={availableStock}
          isLoading={isLoadingStock}
          totalStock={stock}
        />
      )}

      {/* Add to Cart */}
      <motion.div
        animate={{ opacity: 1, x: 0 }}
        initial={{ opacity: 0, x: 20 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-0 bg-linear-to-br from-[#001731] to-[#3DA9E0] p-6 shadow-lg">
          <div className="mb-6 text-center">
            {hasDiscount ? (
              <>
                <div className="mb-1 text-sm text-white/80 line-through">
                  {formatPrice(regularPrice)}
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

          {!isMember && memberPrice && memberPrice < regularPrice && (
            <Alert className="mb-4 border-white/20 bg-background/10">
              <AlertCircle className="h-4 w-4 text-white" />
              <AlertDescription className="text-sm text-white">
                Become a BISO member to save {regularPrice - memberPrice} NOK on
                this item!
              </AlertDescription>
            </Alert>
          )}

          <Button
            className="mb-3 w-full bg-background text-[#001731] hover:bg-background/90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={stock === 0}
            onClick={handleAddToCart}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {stock === 0 ? "Out of Stock" : "Add to Cart"}
          </Button>

          {addedToCart && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 text-sm text-white"
              initial={{ opacity: 0, y: -10 }}
            >
              <CheckCircle2 className="h-4 w-4" />
              Added to cart!
            </motion.div>
          )}
        </Card>
      </motion.div>

      {/* Price Breakdown */}
      <motion.div
        animate={{ opacity: 1, x: 0 }}
        initial={{ opacity: 0, x: 20 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="border-0 p-6 shadow-lg">
          <h3 className="mb-4 font-bold text-foreground">Price Details</h3>
          <div className="space-y-3">
            <PriceDetails
              displayPrice={displayPrice}
              hasDiscount={!!hasDiscount}
              isMember={isMember}
              memberPrice={memberPrice}
              regularPrice={regularPrice}
              savings={savings}
            />
            <Separator />
            <div className="flex justify-between text-muted-foreground text-sm">
              <span>Shipping</span>
              <span className="font-medium text-green-600">
                Free (Campus Pickup)
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground text-sm">
              <span>Tax</span>
              <span>Included</span>
            </div>
          </div>
        </Card>
      </motion.div>
    </>
  );
}
