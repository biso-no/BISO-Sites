"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { createContext, useContext, useMemo, useState } from "react";
import { type ProductOption, parseProductMetadata } from "@/lib/types/webshop";
import { useProductActions } from "../use-product-actions";

type ProductPurchaseContextType = {
  selectedOptions: Record<string, string>;
  handleOptionChange: (optionIndex: number, value: string) => void;
  handleAddToCart: () => Promise<void>;
  addedToCart: boolean;
  errors: Record<string, boolean>;
  availableStock: number | null;
  isLoadingStock: boolean;
  product: ContentTranslations;
  productOptions: ProductOption[];
  isMember: boolean;
};

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
  product: ContentTranslations;
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
    const metadata = parseProductMetadata(product.product_ref?.metadata);
    return (metadata.product_options as ProductOption[]) || [];
  }, [product.product_ref?.metadata]);

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
