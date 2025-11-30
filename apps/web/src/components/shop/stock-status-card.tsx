import { Card } from "@repo/ui/components/ui/card";
import { Package } from "lucide-react";
import { motion } from "motion/react";

type StockStatusCardProps = {
  isLoading: boolean;
  availableStock: number | null;
  totalStock: number | null;
};

// This component is wrapped by AddToCartClient to be part of the client bundle
export function StockStatusCard({
  isLoading,
  availableStock,
  totalStock,
}: StockStatusCardProps) {
  const getStockStatus = () => {
    if (isLoading) {
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
    <motion.div
      animate={{ opacity: 1, x: 0 }}
      initial={{ opacity: 0, x: 20 }}
      transition={{ delay: 0.2 }}
    >
      <Card className={`border-0 p-6 shadow-lg ${currentStockConfig.bg}`}>
        <div className="flex items-center gap-3">
          <Package className={`h-5 w-5 ${currentStockConfig.text}`} />
          <div className="flex-1">
            <div className="font-semibold text-gray-900">
              {currentStockConfig.label}
            </div>
            {!isLoading && availableStock !== null && availableStock > 10 && (
              <div className="text-gray-600 text-sm">
                {availableStock} available
              </div>
            )}
            {!isLoading &&
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
    </motion.div>
  );
}
