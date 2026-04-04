"use client";

import type { WebshopProducts } from "@repo/api/types/appwrite";
import { createContext, useContext, useMemo, useState } from "react";
import { type ProductOption, parseProductMetadata } from "@/lib/types/webshop";
import { useProductActions } from "../use-product-actions";

interface ProductPurchaseContextType {
  addedToCart: boolean;
  availableStock: number | null;
  errors: Record<string, boolean>;
  handleAddToCart: () => Promise<void>;
  handleOptionChange: (optionIndex: number, value: string) => void;
  isLoadingStock: boolean;
  isMember: boolean;
  product: WebshopProducts;
  productOptions: ProductOption[];
  selectedOptions: Record<string, string>;
}

const ProductPurchaseContext = createContext<ProductPurchaseContextType | null>(
  null
);

export function ProductPurchaseProvider({
  children,
  product,
  userId,
  isMember = false,
}: {
  children: React.ReactNode;
  product: WebshopProducts;
  userId?: string | null;
  isMember?: boolean;
}) {
  const {
    handleAddToCart: addToCartAction,
    addedToCart,
    errors,
    clearError,
    availableStock,
    isLoadingStock,
  } = useProductActions(product, userId ?? null);

  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({});

  const productOptions = useMemo(() => {
    const metadata = parseProductMetadata(product.metadata);
    return (metadata.product_options as ProductOption[]) || [];
  }, [product.metadata]);

  const handleOptionChange = (optionIndex: number, value: string) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [`option-${optionIndex}`]: value,
    }));
    clearError(optionIndex);
  };

  const handleAddToCart = async () => {
    await addToCartAction(selectedOptions);
  };

  return (
    <ProductPurchaseContext.Provider
      value={{
        selectedOptions,
        handleOptionChange,
        handleAddToCart,
        addedToCart,
        errors,
        availableStock,
        isLoadingStock,
        product,
        productOptions,
        isMember,
      }}
    >
      {children}
    </ProductPurchaseContext.Provider>
  );
}

export function useProductPurchase() {
  const context = useContext(ProductPurchaseContext);
  if (!context) {
    throw new Error(
      "useProductPurchase must be used within a ProductPurchaseProvider"
    );
  }
  return context;
}
