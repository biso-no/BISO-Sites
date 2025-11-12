'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ProductWithTranslations, ProductVariation, ProductCustomField } from '@/lib/types/product'

export interface CartItem {
  id: string
  productId: string
  slug: string
  title: string
  quantity: number
  unitPrice: number
  basePrice: number
  variation?: {
    id?: string
    name?: string
    priceModifier?: number
    description?: string
  }
  customFieldResponses?: Record<string, string>
  customFields?: {
    id: string
    label: string
    value: string
    required?: boolean
  }[]
  customFieldDefinitions?: Record<string, { label: string; required?: boolean }>
  image?: string
  maxPerOrder?: number
  maxPerUser?: number
  memberDiscountPercent?: number
  memberDiscountEnabled?: boolean
}

interface AddItemInput {
  product: ProductWithTranslations
  quantity?: number
  variation?: ProductVariation
  customFieldResponses?: Record<string, string>
}

interface CartState {
  items: CartItem[]
  addItem: (input: AddItemInput) => { success: boolean; message?: string }
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  setCustomFieldResponse: (id: string, fieldId: string, value: string) => void
  clear: () => void
}

const STORAGE_KEY = 'biso-webshop-cart'

const normalizeResponses = (responses?: Record<string, string>) => {
  if (!responses) return undefined
  const entries = Object.entries(responses)
    .filter(([, value]) => typeof value === 'string')
    .map(([key, value]) => [key, value.trim()] as const)
    .filter(([, value]) => value.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
  if (entries.length === 0) return undefined
  return Object.fromEntries(entries)
}

const createItemId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `item_${Math.random().toString(36).slice(2)}`

const buildCustomFieldDefinitions = (fields?: ProductCustomField[]) => {
  if (!fields || fields.length === 0) return undefined
  return fields.reduce<Record<string, { label: string; required?: boolean }>>((acc, field) => {
    acc[field.id] = { label: field.label, required: field.required }
    return acc
  }, {})
}

const buildCustomFieldEntries = (
  fields?: ProductCustomField[],
  responses?: Record<string, string>
) => {
  if (!fields || !responses) return undefined
  const entries = fields
    .map((field) => {
      const value = responses[field.id]
      if (!value) return null
      return {
        id: field.id,
        label: field.label,
        value,
        required: field.required,
      }
    })
    .filter(Boolean)

  return entries.length > 0 ? (entries as { id: string; label: string; value: string; required?: boolean }[]) : undefined
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: ({ product, quantity = 1, variation, customFieldResponses }) => {
        const items = get().items
        const safeQuantity = Math.max(1, Math.floor(quantity))
        const normalizedResponses = normalizeResponses(customFieldResponses)
        const variationId = variation?.id

        const productItems = items.filter((item) => item.productId === product.$id)
        const matchingItems = productItems.filter(
          (item) => (item.variation?.id || null) === (variationId || null)
        )
        const totalForProduct = productItems.reduce((sum, item) => sum + item.quantity, 0)
        const maxPerOrder = product.max_per_order
        if (maxPerOrder && totalForProduct + safeQuantity > maxPerOrder) {
          return {
            success: false,
            message: `You can only purchase ${maxPerOrder} of this product per order.`,
          }
        }

        if (product.max_per_user === 1 && productItems.length > 0) {
          return {
            success: false,
            message: 'This product is limited to one per customer.',
          }
        }

        const existingIndex = items.findIndex((item) => {
          if (item.productId !== product.$id) return false
          if ((item.variation?.id || null) !== (variationId || null)) return false
          const itemResponses = normalizeResponses(item.customFieldResponses)
          return JSON.stringify(itemResponses) === JSON.stringify(normalizedResponses || undefined)
        })

        const basePrice = Number(product.price || 0)
        const modifier = Number(variation?.price_modifier || 0)
        const unitPrice = Math.max(0, basePrice + modifier)
        const customFieldDefinitions = buildCustomFieldDefinitions(product.custom_fields)
        const customFields = buildCustomFieldEntries(product.custom_fields, normalizedResponses || undefined)

        if (existingIndex >= 0) {
          const existingItem = items[existingIndex]
          const potentialQuantity = existingItem.quantity + safeQuantity

          if (maxPerOrder && potentialQuantity > maxPerOrder) {
            return {
              success: false,
              message: `You can only purchase ${maxPerOrder} of this product per order.`,
            }
          }

          const nextItems = [...items]
          nextItems[existingIndex] = {
            ...existingItem,
            quantity: product.max_per_user === 1 ? 1 : potentialQuantity,
            unitPrice,
            basePrice,
            customFieldResponses: normalizedResponses,
            customFields: customFields || existingItem.customFields,
            customFieldDefinitions: existingItem.customFieldDefinitions || customFieldDefinitions,
          }
          set({ items: nextItems })
          return { success: true }
        }

        const newItem: CartItem = {
          id: createItemId(),
          productId: product.$id,
          slug: product.slug,
          title: product.title || product.slug,
          quantity: product.max_per_user === 1 ? 1 : safeQuantity,
          unitPrice,
          basePrice,
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
        }

        set({ items: [...items, newItem] })
        return { success: true }
      },
      removeItem: (id) => {
        set((state) => ({ items: state.items.filter((item) => item.id !== id) }))
      },
      updateQuantity: (id, quantity) => {
        set((state) => {
          const nextItems = state.items.map((item) => {
            if (item.id !== id) return item
            const safeQuantity = Math.max(1, Math.floor(quantity))
            if (item.maxPerUser === 1) {
              return { ...item, quantity: 1 }
            }
            if (item.maxPerOrder) {
              const others = state.items
                .filter(
                  (other) =>
                    other.id !== id &&
                    other.productId === item.productId
                )
                .reduce((sum, other) => sum + other.quantity, 0)
              const allowed = Math.max(1, item.maxPerOrder - others)
              return { ...item, quantity: Math.min(safeQuantity, allowed) }
            }
            return { ...item, quantity: safeQuantity }
          })
          return { items: nextItems }
        })
      },
      setCustomFieldResponse: (id, fieldId, value) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id !== id) return item
            const responses = { ...(item.customFieldResponses || {}) }
            const trimmed = value.trim()
            if (trimmed.length === 0) {
              delete responses[fieldId]
            } else {
              responses[fieldId] = trimmed
            }
            const definitions = item.customFieldDefinitions || {}
            const nextCustomFields = Object.entries(responses).map(([responseId, responseValue]) => ({
              id: responseId,
              label: definitions[responseId]?.label || responseId,
              value: responseValue,
              required: definitions[responseId]?.required,
            }))
            return {
              ...item,
              customFieldResponses: Object.keys(responses).length ? responses : undefined,
              customFields: nextCustomFields.length ? nextCustomFields : undefined,
            }
          }),
        }))
      },
      clear: () => set({ items: [] }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
)

export const cartSelectors = {
  itemCount: (state: CartState) => state.items.reduce((sum, item) => sum + item.quantity, 0),
  subTotal: (state: CartState) =>
    state.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
}
