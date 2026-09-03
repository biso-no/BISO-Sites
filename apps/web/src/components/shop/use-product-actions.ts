import { resolveStorageFileUrl } from "@repo/api/storage";
import type { WebshopProducts } from "@repo/api/types/appwrite";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createOrUpdateReservation,
  getAvailableStock,
  getUserReservation,
} from "@/app/actions/cart-reservations";
import { validatePurchaseLimits } from "@/app/actions/purchase-limits";
import { getPrimaryTranslation } from "@/lib/content-translation";
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

/**
 * RD-032: the five toasts here were the last hardcoded English strings in the
 * shop. They are built from `shop.toast.*` now, so the message has to be
 * resolved by the caller — a hook cannot reach `getTranslations`.
 */
interface ToastCopy {
  addedToCart: string;
  limitExceeded: string;
  outOfStock: string;
  reserveFailed: string;
  stockAvailable: (count: number) => string;
}

function getStockErrorMessage(
  currentStock: number | null,
  copy: ToastCopy
): string {
  if (currentStock === 0) {
    return copy.outOfStock;
  }
  return copy.stockAvailable(currentStock ?? 0);
}

async function checkStockAvailability(
  productId: string,
  quantity: number,
  hasStock: boolean
): Promise<{ available: boolean; currentStock: number | null }> {
  if (!hasStock) {
    return { available: true, currentStock: null };
  }
  // getAvailableStock subtracts the caller's own active hold, so add it back —
  // otherwise the buyer's own cart reservation blocks re-adding/updating the
  // last units of a product (PR-036).
  const [currentAvailable, myHold] = await Promise.all([
    getAvailableStock(productId),
    getUserReservation(productId),
  ]);
  const effectiveAvailable = currentAvailable + (myHold?.quantity ?? 0);
  return {
    available: effectiveAvailable >= quantity,
    currentStock: effectiveAvailable,
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

interface BuildCartItemParams {
  locale: string;
  metadata: ReturnType<typeof parseProductMetadata>;
  namedOptions: Record<string, string>;
  product: WebshopProducts;
  productId: string;
}

function buildCartItem({
  product,
  productId,
  namedOptions,
  metadata,
  locale,
}: BuildCartItemParams) {
  const productRef = product;
  // The v2 detail reader keeps every translation so the page can render the
  // active locale; taking the first one here put an English-displayed product
  // into the cart under its Norwegian name. Resolve the same locale the page
  // rendered with.
  const translation = getPrimaryTranslation(product, locale);
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
    contentId: product.$id,
    productId,
    slug: productRef.slug ?? "",
    name: translation?.title ?? productRef.slug,
    image: resolveStorageFileUrl(productRef.image),
    category: productRef.category ?? "",
    regularPrice: productRef.regular_price ?? 0,
    memberPrice: productRef.member_price,
    memberOnly: productRef.member_only ?? false,
    stock: productRef.stock,
    selectedOptions: hasOptions ? namedOptions : undefined,
    metadata: { max_per_user: maxPerUser, max_per_order: maxPerOrder, sku },
  };
}

export function useProductActions(
  product: WebshopProducts,
  userId: string | null
) {
  const t = useTranslations("shop.toast");
  const locale = useLocale();
  const copy: ToastCopy = {
    addedToCart: t("addedToCart"),
    limitExceeded: t("limitExceeded"),
    outOfStock: t("outOfStock"),
    reserveFailed: t("reserveFailed"),
    stockAvailable: (count: number) => t("onlyAvailable", { count }),
  };
  const { addItem } = useCart();
  const [addedToCart, setAddedToCart] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [isLoadingStock, setIsLoadingStock] = useState(false);

  const productRef = product;
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
      toast.error(getStockErrorMessage(stockCheck.currentStock, copy));
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
      toast.error(limitCheck.reason || copy.limitExceeded);
      return;
    }

    const reservation = await reserveStock(productId, quantity, hasStock);
    if (!reservation.success) {
      toast.error(copy.reserveFailed);
      return;
    }
    if (reservation.newAvailable !== null) {
      setAvailableStock(reservation.newAvailable);
    }

    const namedOptions = buildNamedOptions(productOptions, selectedOptions);
    const cartItem = buildCartItem({
      locale,
      product,
      productId,
      namedOptions,
      metadata,
    });
    addItem(cartItem);

    setAddedToCart(true);
    toast.success(copy.addedToCart);
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
