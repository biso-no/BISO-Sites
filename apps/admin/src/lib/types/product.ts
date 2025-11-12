import { Models } from '@repo/api'
import { ContentTranslation } from './content-translation'

export type ProductCustomFieldType = 'text' | 'textarea' | 'number' | 'select'

export interface ProductCustomField {
  id: string
  label: string
  type: ProductCustomFieldType
  required?: boolean
  placeholder?: string
  options?: string[]
}

export interface ProductVariation {
  id: string
  name: string
  description?: string
  price_modifier?: number
  sku?: string
  stock_quantity?: number
  is_default?: boolean
}

export interface Product extends Models.Row {
  slug: string
  status: 'draft' | 'published' | 'archived'
  campus_id: string
  metadata?: string // JSON string for non-translatable data (price, sku, stock, etc.)
  
  // Relationship references (populated at runtime)
  campus?: { $id: string; name: string }
  translation_refs?: ContentTranslation[]
}

// Helper interface for working with product data including translations
export interface ProductWithTranslations extends Product {
  // Convenience properties for the current locale
  title?: string
  description?: string
  price?: number
  sku?: string
  stock_quantity?: number
  category?: string
  image?: string
  images?: string[]
  weight?: number
  dimensions?: string
  is_digital?: boolean
  shipping_required?: boolean
  member_discount_enabled?: boolean
  member_discount_percent?: number
  max_per_user?: number
  max_per_order?: number
  custom_fields?: ProductCustomField[]
  variations?: ProductVariation[]
}

export interface ProductMetadata {
  price?: number
  sku?: string
  stock_quantity?: number
  category?: string
  image?: string
  images?: string[]
  weight?: number
  dimensions?: string
  is_digital?: boolean
  shipping_required?: boolean
  member_discount_enabled?: boolean
  member_discount_percent?: number
  max_per_user?: number
  max_per_order?: number
  custom_fields?: ProductCustomField[]
  variations?: ProductVariation[]
}

export interface ProductTranslation {
  title: string
  description: string
}

export interface CreateProductData {
  slug: string
  status: 'draft' | 'published' | 'archived'
  campus_id: string
  metadata?: ProductMetadata
  translations: {
    en?: ProductTranslation
    no?: ProductTranslation
  }
}

export interface UpdateProductData {
  slug?: string
  status?: 'draft' | 'published' | 'archived'
  campus_id?: string
  metadata?: ProductMetadata
  translations?: {
    en?: ProductTranslation
    no?: ProductTranslation
  }
}

export interface ListProductsParams {
  status?: 'draft' | 'published' | 'archived'
  campus_id?: string
  locale?: 'en' | 'no'
  limit?: number
  offset?: number
  search?: string
}
