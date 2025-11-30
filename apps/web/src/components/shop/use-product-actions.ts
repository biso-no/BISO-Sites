import type { ContentTranslations } from "@repo/api/types/appwrite";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createOrUpdateReservation,
  getAvailableStock,
} from "@/app/actions/cart-reservations";
import { validatePurchaseLimits } from "@/app/actions/purchase-limits";
import { useCart } from "@/lib/contexts/cart-context";
import { type ProductOption, parseProductMetadata } from "@/lib/types/webshop";

function validateRequiredOptions(
  productOptions: ProductOption[],
  selectedOptions: Record<string, string>
): Record<string, boolean> {
  const errors: Record<string, boolean> = {};
  for (const [index, option] of productOptions.entries()) {
    if (option.required && !selectedOptions[`option-${index}`]) {
      errors[`option-${index}`] = true;
    }
  }
  return errors;
}

function buildNamedOptions(
  productOptions: ProductOption[],
  selectedOptions: Record<string, string>
): Record<string, string> {
  const namedOptions: Record<string, string> = {};
  for (const [index, option] of productOptions.entries()) {
    const value = selectedOptions[`option-${index}`];
    if (value) {
      namedOptions[option.label] = value;
    }
  }
  return namedOptions;
}

function getStockErrorMessage(currentStock: number | null): string {
  if (currentStock === 0) {
    return "This item is out of stock";
  }
  return `Only ${currentStock} available (others reserved in carts)`;
}

async function checkStockAvailability(
  productId: string,
  quantity: number,
  hasStock: boolean
): Promise<{ available: boolean; currentStock: number | null }> {
  if (!hasStock) {
    return { available: true, currentStock: null };
  }
  const currentAvailable = await getAvailableStock(productId);
  return {
    available: currentAvailable >= quantity,
    currentStock: currentAvailable,
  };
}

async function reserveStock(
  productId: string,
  quantity: number,
  hasStock: boolean
): Promise<{ success: boolean; newAvailable: number | null }> {
  if (!hasStock) {
    return { success: true, newAvailable: null };
  }
  const reservationResult = await createOrUpdateReservation(
    productId,
    quantity
  );
  if (!reservationResult.success) {
    return { success: false, newAvailable: null };
  }
  const newAvailable = await getAvailableStock(productId);
  return { success: true, newAvailable };
}

type BuildCartItemParams = {
  product: ContentTranslations;
  productId: string;
  namedOptions: Record<string, string>;
  metadata: ReturnType<typeof parseProductMetadata>;
};

function buildCartItem({
  product,
  productId,
  namedOptions,
  metadata,
}: BuildCartItemParams) {
  const productRef = product.product_ref;
  const hasOptions = Object.keys(namedOptions).length > 0;

  const maxPerUser =
    typeof metadata.max_per_user === "number"
      ? metadata.max_per_user
      : undefined;
  const maxPerOrder =
    typeof metadata.max_per_order === "number"
      ? metadata.max_per_order
      : undefined;
  const sku = typeof metadata.sku === "string" ? metadata.sku : undefined;

  return {
    contentId: product.content_id,
    productId,
    slug: productRef?.slug ?? "",
    name: product.title,
    image: productRef?.image,
    category: productRef?.category ?? "",
    regularPrice: productRef?.regular_price ?? 0,
    memberPrice: productRef?.member_price,
    memberOnly: productRef?.member_only ?? false,
    stock: productRef?.stock,
    selectedOptions: hasOptions ? namedOptions : undefined,
    metadata: { max_per_user: maxPerUser, max_per_order: maxPerOrder, sku },
  };
}

export function useProductActions(
  product: ContentTranslations,
  userId: string | null
) {
  const { addItem } = useCart();
  const [addedToCart, setAddedToCart] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [isLoadingStock, setIsLoadingStock] = useState(false);

  const productRef = product.product_ref;
  const metadata = parseProductMetadata(productRef?.metadata);
  const productOptions = (metadata.product_options as ProductOption[]) || [];

  useEffect(() => {
    async function loadAvailableStock() {
      if (productRef?.stock === null || productRef?.stock === undefined) {
        setAvailableStock(null); // Infinite stock
        return;
      }

      setIsLoadingStock(true);
      const available = await getAvailableStock(productRef?.$id ?? "");
      setAvailableStock(available);
      setIsLoadingStock(false);
    }

    loadAvailableStock();
  }, [productRef?.$id, productRef?.stock]);

  const handleAddToCart = async (selectedOptions: Record<string, string>) => {
    const newErrors = validateRequiredOptions(productOptions, selectedOptions);
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const quantity = 1;
    const productId = productRef?.$id ?? "";
    const hasStock =
      productRef?.stock !== null && productRef?.stock !== undefined;

    const stockCheck = await checkStockAvailability(
      productId,
      quantity,
      hasStock
    );
    if (!stockCheck.available) {
      toast.error(getStockErrorMessage(stockCheck.currentStock));
      setAvailableStock(stockCheck.currentStock);
      return;
    }

    const limitCheck = await validatePurchaseLimits(
      productId,
      userId || "guest",
      quantity,
      metadata
    );
    if (!limitCheck.allowed) {
      toast.error(limitCheck.reason || "Purchase limit exceeded");
      return;
    }

    const reservation = await reserveStock(productId, quantity, hasStock);
    if (!reservation.success) {
      toast.error("Failed to reserve stock. Please try again.");
      return;
    }
    if (reservation.newAvailable !== null) {
      setAvailableStock(reservation.newAvailable);
    }

    const namedOptions = buildNamedOptions(productOptions, selectedOptions);
    const cartItem = buildCartItem({
      product,
      productId,
      namedOptions,
      metadata,
    });
    addItem(cartItem);

    setAddedToCart(true);
    toast.success("Added to cart");
    setTimeout(() => setAddedToCart(false), 3000);
  };

  const clearError = (optionIndex: number) => {
    if (errors[`option-${optionIndex}`]) {
      const newErrors = { ...errors };
      delete newErrors[`option-${optionIndex}`];
      setErrors(newErrors);
    }
  };

  return {
    handleAddToCart,
    addedToCart,
    errors,
    clearError,
    availableStock,
    isLoadingStock,
  };
}
