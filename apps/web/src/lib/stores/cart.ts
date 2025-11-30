"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  ProductCustomField,
  ProductVariation,
  ProductWithTranslations,
} from "@/lib/types/product";

type CartItem = {
  id: string;
  productId: string;
  slug: string;
  title: string;
  quantity: number;
  unitPrice: number;
  basePrice: number;
  variation?: {
    id?: string;
    name?: string;
    priceModifier?: number;
    description?: string;
  };
  customFieldResponses?: Record<string, string>;
  customFields?: {
    id: string;
    label: string;
    value: string;
    required?: boolean;
  }[];
  customFieldDefinitions?: Record<
    string,
    { label: string; required?: boolean }
  >;
  image?: string;
  maxPerOrder?: number;
  maxPerUser?: number;
  memberDiscountPercent?: number;
  memberDiscountEnabled?: boolean;
};

type AddItemInput = {
  product: ProductWithTranslations;
  quantity?: number;
  variation?: ProductVariation;
  customFieldResponses?: Record<string, string>;
};

type ProductWithOptionalFields = ProductWithTranslations & {
  custom_fields?: ProductCustomField[];
  max_per_order?: number | null;
  max_per_user?: number | null;
  images?: string[];
  image?: string;
  member_discount_enabled?: boolean;
  member_discount_percent?: number;
  price?: number;
};

type Variation = ProductVariation;

type CartState = {
  items: CartItem[];
  addItem: (input: AddItemInput) => { success: boolean; message?: string };
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  setCustomFieldResponse: (id: string, fieldId: string, value: string) => void;
  clear: () => void;
};

const STORAGE_KEY = "biso-webshop-cart";

const normalizeResponses = (responses?: Record<string, string>) => {
  if (!responses) {
    return;
  }
  const entries = Object.entries(responses)
    .filter(([, value]) => typeof value === "string")
    .map(([key, value]) => [key, value.trim()] as const)
    .filter(([, value]) => value.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    return;
  }
  return Object.fromEntries(entries);
};

const createItemId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `item_${Math.random().toString(36).slice(2)}`;

const buildCustomFieldDefinitions = (fields?: ProductCustomField[]) => {
  if (!fields || fields.length === 0) {
    return;
  }
  return fields.reduce<Record<string, { label: string; required?: boolean }>>(
    (acc, field) => {
      acc[field.id] = { label: field.label, required: field.required };
      return acc;
    },
    {}
  );
};

const buildCustomFieldEntries = (
  fields?: ProductCustomField[],
  responses?: Record<string, string>
) => {
  if (!(fields && responses)) {
    return;
  }
  const entries = fields
    .map((field) => {
      const value = responses[field.id];
      if (!value) {
        return null;
      }
      return {
        id: field.id,
        label: field.label,
        value,
        required: field.required,
      };
    })
    .filter(Boolean);

  return entries.length > 0
    ? (entries as {
        id: string;
        label: string;
        value: string;
        required?: boolean;
      }[])
    : undefined;
};

const getSafeQuantity = (quantity: number) => Math.max(1, Math.floor(quantity));

const filterItemsForProduct = (items: CartItem[], productId: string) =>
  items.filter((item) => item.productId === productId);

const findMatchingItemIndex = (
  items: CartItem[],
  productId: string,
  variationId?: string,
  normalizedResponses?: Record<string, string>
) =>
  items.findIndex((item) => {
    if (item.productId !== productId) {
      return false;
    }
    if ((item.variation?.id || null) !== (variationId || null)) {
      return false;
    }
    const itemResponses = normalizeResponses(item.customFieldResponses);
    return (
      JSON.stringify(itemResponses) ===
      JSON.stringify(normalizedResponses || undefined)
    );
  });

const calculatePricing = (
  product: ProductWithOptionalFields,
  variation?: Variation
) => {
  const basePrice = Number(product.price || 0);
  const modifier = Number(variation?.price_modifier || 0);
  const unitPrice = Math.max(0, basePrice + modifier);

  return { basePrice, unitPrice, modifier };
};

const buildCustomFieldData = (
  product: ProductWithOptionalFields,
  normalizedResponses?: Record<string, string>
) => {
  const customFieldDefinitions = buildCustomFieldDefinitions(
    product.custom_fields
  );
  const customFields = buildCustomFieldEntries(
    product.custom_fields,
    normalizedResponses || undefined
  );

  return { customFieldDefinitions, customFields };
};

const validateProductLimits = (
  product: ProductWithOptionalFields,
  productItems: CartItem[],
  safeQuantity: number
) => {
  const totalForProduct = productItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const maxPerOrder = product.max_per_order;
  if (maxPerOrder && totalForProduct + safeQuantity > maxPerOrder) {
    return {
      success: false as const,
      message: `You can only purchase ${maxPerOrder} of this product per order.`,
    };
  }

  if (product.max_per_user === 1 && productItems.length > 0) {
    return {
      success: false as const,
      message: "This product is limited to one per customer.",
    };
  }

  return { success: true as const };
};

const updateExistingCartItem = ({
  items,
  existingIndex,
  safeQuantity,
  product,
  pricing,
  normalizedResponses,
  customFields,
  customFieldDefinitions,
}: {
  items: CartItem[];
  existingIndex: number;
  safeQuantity: number;
  product: ProductWithOptionalFields;
  pricing: { basePrice: number; unitPrice: number };
  normalizedResponses?: Record<string, string>;
  customFields?: CartItem["customFields"];
  customFieldDefinitions?: CartItem["customFieldDefinitions"];
}) => {
  const existingItem = items[existingIndex];
  const potentialQuantity = existingItem.quantity + safeQuantity;
  const maxPerOrder = product.max_per_order;

  if (maxPerOrder && potentialQuantity > maxPerOrder) {
    return {
      success: false as const,
      message: `You can only purchase ${maxPerOrder} of this product per order.`,
    };
  }

  const nextItems = [...items];
  nextItems[existingIndex] = {
    ...existingItem,
    quantity: product.max_per_user === 1 ? 1 : potentialQuantity,
    unitPrice: pricing.unitPrice,
    basePrice: pricing.basePrice,
    customFieldResponses: normalizedResponses,
    customFields: customFields || existingItem.customFields,
    customFieldDefinitions:
      existingItem.customFieldDefinitions || customFieldDefinitions,
  };

  return { success: true as const, items: nextItems };
};

const createCartEntry = ({
  product,
  safeQuantity,
  pricing,
  variation,
  normalizedResponses,
  customFields,
  customFieldDefinitions,
}: {
  product: ProductWithOptionalFields;
  safeQuantity: number;
  pricing: { basePrice: number; unitPrice: number; modifier: number };
  variation?: Variation;
  normalizedResponses?: Record<string, string>;
  customFields?: CartItem["customFields"];
  customFieldDefinitions?: CartItem["customFieldDefinitions"];
}): CartItem => ({
  id: createItemId(),
  productId: product.$id,
  slug: product.slug,
  title: product.title || product.slug,
  quantity: product.max_per_user === 1 ? 1 : safeQuantity,
  unitPrice: pricing.unitPrice,
  basePrice: pricing.basePrice,
  variation: variation
    ? {
        id: variation.id,
        name: variation.name,
        priceModifier: variation.price_modifier ?? 0,
        description: variation.description,
      }
    : undefined,
  customFieldResponses: normalizedResponses,
  customFields,
  customFieldDefinitions,
  image: product.images?.[0] || product.image,
  maxPerOrder: product.max_per_order,
  maxPerUser: product.max_per_user,
  memberDiscountEnabled: product.member_discount_enabled,
  memberDiscountPercent: product.member_discount_percent,
});

const updateCustomFieldValue = (
  item: CartItem,
  fieldId: string,
  value: string
) => {
  const responses = { ...(item.customFieldResponses || {}) };
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    delete responses[fieldId];
  } else {
    responses[fieldId] = trimmed;
  }
  const definitions = item.customFieldDefinitions || {};
  const nextCustomFields = Object.entries(responses).map(
    ([responseId, responseValue]) => ({
      id: responseId,
      label: definitions[responseId]?.label || responseId,
      value: responseValue,
      required: definitions[responseId]?.required,
    })
  );
  return {
    ...item,
    customFieldResponses: Object.keys(responses).length ? responses : undefined,
    customFields: nextCustomFields.length ? nextCustomFields : undefined,
  };
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: ({ product, quantity = 1, variation, customFieldResponses }) => {
        const items = get().items;
        const safeQuantity = getSafeQuantity(quantity);
        const normalizedResponses = normalizeResponses(customFieldResponses);
        const variationId = variation?.id;

        const productItems = filterItemsForProduct(items, product.$id);
        const limitResult = validateProductLimits(
          product,
          productItems,
          safeQuantity
        );
        if (!limitResult.success) {
          return limitResult;
        }

        const existingIndex = findMatchingItemIndex(
          items,
          product.$id,
          variationId,
          normalizedResponses
        );

        const pricing = calculatePricing(product, variation);
        const { customFields, customFieldDefinitions } = buildCustomFieldData(
          product,
          normalizedResponses || undefined
        );

        if (existingIndex >= 0) {
          const updateResult = updateExistingCartItem({
            items,
            existingIndex,
            safeQuantity,
            product,
            pricing,
            normalizedResponses,
            customFields,
            customFieldDefinitions,
          });
          if (!updateResult.success) {
            return updateResult;
          }
          set({ items: updateResult.items });
          return { success: true };
        }

        const newItem = createCartEntry({
          product,
          safeQuantity,
          pricing,
          variation,
          normalizedResponses,
          customFields,
          customFieldDefinitions,
        });

        set({ items: [...items, newItem] });
        return { success: true };
      },
      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },
      updateQuantity: (id, quantity) => {
        set((state) => {
          const nextItems = state.items.map((item) => {
            if (item.id !== id) {
              return item;
            }
            const safeQuantity = Math.max(1, Math.floor(quantity));
            if (item.maxPerUser === 1) {
              return { ...item, quantity: 1 };
            }
            if (item.maxPerOrder) {
              const others = state.items
                .filter(
                  (other) =>
                    other.id !== id && other.productId === item.productId
                )
                .reduce((sum, other) => sum + other.quantity, 0);
              const allowed = Math.max(1, item.maxPerOrder - others);
              return { ...item, quantity: Math.min(safeQuantity, allowed) };
            }
            return { ...item, quantity: safeQuantity };
          });
          return { items: nextItems };
        });
      },
      setCustomFieldResponse: (id, fieldId, value) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? updateCustomFieldValue(item, fieldId, value) : item
          ),
        }));
      },
      clear: () => set({ items: [] }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);

export const cartSelectors = {
  itemCount: (state: CartState) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0),
  subTotal: (state: CartState) =>
    state.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
};
