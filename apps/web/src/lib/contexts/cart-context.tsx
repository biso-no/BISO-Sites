"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import { useLocale, useTranslations } from "next-intl";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";
import {
  createOrUpdateReservation,
  deleteAllReservations,
  deleteReservation,
  getCartItemsWithDetails,
} from "@/app/actions/cart-reservations";

type ReservationFailureReason = "out_of_stock" | "error";

export interface CartItem {
  category: string;
  contentId: string; // product content_id from database
  expiresAt?: string; // reservation expiration time
  id: string; // unique cart item id (contentId + options hash)
  image: string | null;
  memberOnly: boolean;
  memberPrice: number | null;
  metadata?: {
    max_per_user?: number;
    max_per_order?: number;
    sku?: string;
  };
  name: string;
  productId: string; // product webshop_products id
  quantity: number;
  regularPrice: number;
  selectedOptions?: Record<string, string>;
  slug: string;
  stock: number | null;
}

interface CartContextType {
  addItem: (
    item: Omit<CartItem, "id" | "quantity"> & { quantity?: number }
  ) => Promise<void>;
  clearCart: () => Promise<void>;
  closeDrawer: () => void;
  getEarliestExpiration: () => string | null;
  getItemCount: () => number;
  getRegularSubtotal: () => number;
  getSubtotal: (isMember: boolean) => number;
  getTotalSavings: (isMember: boolean) => number;
  isDrawerOpen: boolean;
  isLoading: boolean;
  items: CartItem[];
  openDrawer: () => void;
  refreshCart: () => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}

function generateCartItemId(
  contentId: string,
  selectedOptions?: Record<string, string>
): string {
  const optionsHash = selectedOptions
    ? Object.entries(selectedOptions)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join("|")
    : "";
  return `${contentId}${optionsHash ? `-${btoa(optionsHash)}` : ""}`;
}

function clampQuantity({
  quantity,
  metadata,
  stock,
}: {
  quantity: number;
  metadata?: CartItem["metadata"];
  stock: number | null;
}): number {
  let result = quantity;

  if (metadata?.max_per_order && result > metadata.max_per_order) {
    result = metadata.max_per_order;
  }

  if (stock !== null) {
    result = Math.min(result, stock);
  }

  return result;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [_mounted, setMounted] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const locale = useLocale() as "en" | "no";
  const t = useTranslations("shop");

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  // Load cart from database on mount
  const refreshCart = useCallback(async () => {
    try {
      setIsLoading(true);
      const cartData = await getCartItemsWithDetails(locale);

      const cartItems: CartItem[] = cartData.map((item) => ({
        id: generateCartItemId(item.productId, undefined), // options not stored in DB yet
        contentId: item.productId,
        productId: item.productId,
        slug: item.slug,
        name: item.name,
        image: item.image,
        category: item.category,
        regularPrice: item.regularPrice,
        memberPrice: item.memberPrice,
        memberOnly: item.memberOnly,
        quantity: item.quantity,
        stock: item.stock,
        expiresAt: item.expiresAt,
        metadata: item.metadata,
      }));

      setItems(cartItems);
    } catch (error) {
      console.error("Error loading cart:", error);
    } finally {
      setIsLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    setMounted(true);
    refreshCart();
  }, [refreshCart]);

  // A reservation write failed (out of stock, or a server error). Never apply
  // the returned quantity (it may be 0, which would strand an uncheckoutable
  // line) — tell the shopper and re-sync the cart from the authoritative server
  // state instead.
  const handleReservationFailure = useCallback(
    (reason?: ReservationFailureReason) => {
      toast.error(
        reason === "out_of_stock"
          ? t("cart.outOfStock")
          : t("cart.updateFailed")
      );
      refreshCart();
    },
    [refreshCart, t]
  );

  const addItem = async (
    item: Omit<CartItem, "id" | "quantity"> & { quantity?: number }
  ) => {
    const id = generateCartItemId(item.contentId, item.selectedOptions);
    const baseQuantity = item.quantity ?? 1;

    const existingItem = items.find((i) => i.id === id);

    if (existingItem) {
      const newQuantity = clampQuantity({
        quantity: existingItem.quantity + baseQuantity,
        metadata: item.metadata,
        stock: item.stock,
      });

      // The server caps to live availability and returns the effective quantity;
      // trust it over the optimistic local clamp so the cart can't oversell.
      const result = await createOrUpdateReservation(
        item.productId,
        newQuantity
      );
      if (!result.success) {
        handleReservationFailure(result.reason);
        return;
      }
      const finalQuantity = result.quantity ?? newQuantity;

      setItems((prevItems) =>
        prevItems.map((i) =>
          i.id === id ? { ...i, quantity: finalQuantity } : i
        )
      );
      trackEvent("add_to_cart", {
        productId: item.productId,
        name: item.name,
        category: item.category,
        quantity: baseQuantity,
      });
      setIsDrawerOpen(true);
      return;
    }

    const initialQuantity = clampQuantity({
      quantity: baseQuantity,
      metadata: item.metadata,
      stock: item.stock,
    });

    const result = await createOrUpdateReservation(
      item.productId,
      initialQuantity
    );
    if (!result.success) {
      handleReservationFailure(result.reason);
      return;
    }
    const finalQuantity = result.quantity ?? initialQuantity;

    const newItem: CartItem = {
      ...item,
      id,
      quantity: finalQuantity,
    };
    setItems((prevItems) => [...prevItems, newItem]);
    trackEvent("add_to_cart", {
      productId: item.productId,
      name: item.name,
      category: item.category,
      quantity: finalQuantity,
    });
    setIsDrawerOpen(true);
  };

  const removeItem = async (itemId: string) => {
    const item = items.find((i) => i.id === itemId);

    if (item) {
      // Delete from database
      await deleteReservation(item.productId);

      // Remove from local state
      setItems((prevItems) =>
        prevItems.filter((cartItem) => cartItem.id !== itemId)
      );
      trackEvent("remove_from_cart", {
        productId: item.productId,
        name: item.name,
      });
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    const item = items.find((i) => i.id === itemId);

    if (item) {
      let newQuantity = Math.max(1, quantity);

      // Check max_per_order limit
      if (
        item.metadata?.max_per_order &&
        newQuantity > item.metadata.max_per_order
      ) {
        newQuantity = item.metadata.max_per_order;
      }

      // Check stock limit
      if (item.stock !== null) {
        newQuantity = Math.min(newQuantity, item.stock);
      }

      // Update in database; the server caps to live availability and returns the
      // effective quantity, which wins over the optimistic local clamp.
      const result = await createOrUpdateReservation(
        item.productId,
        newQuantity
      );
      if (!result.success) {
        handleReservationFailure(result.reason);
        return;
      }
      const finalQuantity = result.quantity ?? newQuantity;

      // Update local state
      setItems((prevItems) =>
        prevItems.map((i) => {
          if (i.id === itemId) {
            return { ...i, quantity: finalQuantity };
          }
          return i;
        })
      );
    }
  };

  const clearCart = async () => {
    await deleteAllReservations();
    setItems([]);
  };

  const getItemCount = () =>
    items.reduce((sum, item) => sum + item.quantity, 0);

  const getSubtotal = (isMember: boolean) =>
    items.reduce((sum, item) => {
      const price =
        isMember && item.memberPrice ? item.memberPrice : item.regularPrice;
      return sum + price * item.quantity;
    }, 0);

  const getRegularSubtotal = () =>
    items.reduce((sum, item) => sum + item.regularPrice * item.quantity, 0);

  const getTotalSavings = (isMember: boolean) => {
    if (!isMember) {
      return 0;
    }
    return getRegularSubtotal() - getSubtotal(isMember);
  };

  const getEarliestExpiration = (): string | null => {
    if (items.length === 0) {
      return null;
    }

    const expirationsWithTime = items
      .filter((item) => item.expiresAt)
      .map((item) => item.expiresAt!);

    if (expirationsWithTime.length === 0) {
      return null;
    }

    // Return the earliest expiration time
    return expirationsWithTime.sort()[0] || null;
  };

  return (
    <CartContext.Provider
      value={{
        items,
        isLoading,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getItemCount,
        getSubtotal,
        getRegularSubtotal,
        getTotalSavings,
        refreshCart,
        getEarliestExpiration,
        isDrawerOpen,
        openDrawer,
        closeDrawer,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
