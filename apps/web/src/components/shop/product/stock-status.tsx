"use client";

import { Card } from "@repo/ui/components/ui/card";
import { Package } from "lucide-react";
import { useProductPurchase } from "./product-purchase-provider";

export function StockStatus() {
  const { availableStock, isLoadingStock, product } = useProductPurchase();
  const totalStock = product.product_ref?.stock ?? null;

  if (totalStock === null) {
    return null; // Infinite stock or hidden
  }

  const getStockStatus = () => {
    if (isLoadingStock) {
      return "loading";
    }
    if (availableStock === 0) {
      return "outOfStock";
    }
    if (availableStock !== null && availableStock <= 10) {
      return "lowStock";
    }
    return "inStock";
  };

  const stockStatus = getStockStatus();

  const stockConfig = {
    loading: {
      bg: "bg-gray-50",
      text: "text-gray-600",
      label: "Checking availability...",
    },
    outOfStock: {
      bg: "bg-red-50",
      text: "text-red-600",
      label: "Out of Stock",
    },
    lowStock: {
      bg: "bg-orange-50",
      text: "text-orange-600",
      label: `Only ${availableStock} available!`,
    },
    inStock: {
      bg: "bg-green-50",
      text: "text-green-600",
      label: "In Stock",
    },
  };

  const currentStockConfig = stockConfig[stockStatus];

  return (
    <Card className={`border-0 p-6 shadow-lg ${currentStockConfig.bg}`}>
      <div className="flex items-center gap-3">
        <Package className={`h-5 w-5 ${currentStockConfig.text}`} />
        <div className="flex-1">
          <div className="font-semibold text-gray-900">
            {currentStockConfig.label}
          </div>
          {!isLoadingStock &&
            availableStock !== null &&
            availableStock > 10 && (
              <div className="text-gray-600 text-sm">
                {availableStock} available
              </div>
            )}
          {!isLoadingStock &&
            availableStock !== null &&
            (totalStock ?? 0) > 0 &&
            availableStock < (totalStock ?? 0) && (
              <div className="mt-1 text-gray-500 text-xs">
                {(totalStock ?? 0) - availableStock} reserved in carts
              </div>
            )}
        </div>
      </div>
    </Card>
  );
}
