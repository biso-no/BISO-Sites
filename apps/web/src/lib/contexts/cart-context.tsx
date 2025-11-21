"use client";

import { useLocale } from "next-intl";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  createOrUpdateReservation,
  deleteReservation,
  getCartItemsWithDetails,
} from "@/app/actions/cart-reservations";

export interface CartItem {
  id: string; // unique cart item id (contentId + options hash)
  contentId: string; // product content_id from database
  productId: string; // product webshop_products id
  slug: string;
  name: string;
  image: string | null;
  category: string;
  regularPrice: number;
  memberPrice: number | null;
  memberOnly: boolean;
  quantity: number;
  stock: number | null;
  expiresAt?: string; // reservation expiration time
  selectedOptions?: Record<string, string>;
  metadata?: {
    max_per_user?: number;
    max_per_order?: number;
    sku?: string;
  };
}

interface CartContextType {
  items: CartItem[];
  isLoading: boolean;
  addItem: (
    item: Omit<CartItem, "id" | "quantity"> & { quantity?: number }
  ) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  clearCart: () => void;
  getItemCount: () => number;
  getSubtotal: (isMember: boolean) => number;
  getRegularSubtotal: () => number;
  getTotalSavings: (isMember: boolean) => number;
  refreshCart: () => Promise<void>;
  getEarliestExpiration: () => string | null;
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

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const locale = useLocale() as "en" | "no";

  // Load cart from database on mount
  const refreshCart = async () => {
    try {
      setIsLoading(true);
      const cartData = await getCartItemsWithDetails(locale);

      const cartItems: CartItem[] = cartData.map((item) => ({
        id: generateCartItemId(item.productId, undefined), // TODO: Handle options
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
  };

  useEffect(() => {
    setMounted(true);
    refreshCart();
  }, [locale]);

  const addItem = async (
    item: Omit<CartItem, "id" | "quantity"> & { quantity?: number }
  ) => {
    const id = generateCartItemId(item.contentId, item.selectedOptions);
    const quantity = item.quantity || 1;

    // Check if item exists
    const existingItem = items.find((i) => i.id === id);

    if (existingItem) {
      // Update quantity
      let newQuantity = existingItem.quantity + quantity;

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

      // Update in database
      await createOrUpdateReservation(item.productId, newQuantity);

      // Update local state
      setItems((prevItems) =>
        prevItems.map((i) =>
          i.id === id ? { ...i, quantity: newQuantity } : i
        )
      );
    } else {
      // Add new item
      let initialQuantity = quantity;

      // Check max_per_order limit for new item
      if (
        item.metadata?.max_per_order &&
        initialQuantity > item.metadata.max_per_order
      ) {
        initialQuantity = item.metadata.max_per_order;
      }

      // Check stock limit for new item
      if (item.stock !== null && initialQuantity > item.stock) {
        initialQuantity = item.stock;
      }

      // Create in database
      await createOrUpdateReservation(item.productId, initialQuantity);

      // Add to local state
      const newItem: CartItem = {
        ...item,
        id,
        quantity: initialQuantity,
      };
      setItems((prevItems) => [...prevItems, newItem]);
    }
  };

  const removeItem = async (itemId: string) => {
    const item = items.find((i) => i.id === itemId);

    if (item) {
      // Delete from database
      await deleteReservation(item.productId);

      // Remove from local state
      setItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
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

      // Update in database
      await createOrUpdateReservation(item.productId, newQuantity);

      // Update local state
      setItems((prevItems) =>
        prevItems.map((i) => {
          if (i.id === itemId) {
            return { ...i, quantity: newQuantity };
          }
          return i;
        })
      );
    }
  };

  const clearCart = () => {
    // TODO: Delete all reservations from database
    setItems([]);
  };

  const getItemCount = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getSubtotal = (isMember: boolean) => {
    return items.reduce((sum, item) => {
      const price =
        isMember && item.memberPrice ? item.memberPrice : item.regularPrice;
      return sum + price * item.quantity;
    }, 0);
  };

  const getRegularSubtotal = () => {
    return items.reduce(
      (sum, item) => sum + item.regularPrice * item.quantity,
      0
    );
  };

  const getTotalSavings = (isMember: boolean) => {
    if (!isMember) return 0;
    return getRegularSubtotal() - getSubtotal(isMember);
  };

  const getEarliestExpiration = (): string | null => {
    if (items.length === 0) return null;

    const expirationsWithTime = items
      .filter((item) => item.expiresAt)
      .map((item) => item.expiresAt!);

    if (expirationsWithTime.length === 0) return null;

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
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
